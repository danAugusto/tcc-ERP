import logging
from django.contrib.auth import get_user_model
from rest_framework import generics, viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from .models import Perfil, Permissao, RolePermissao
from .permissions import IsAdministrador, tem_permissao
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import MeSerializer, RegisterSerializer, FuncionarioSerializer

User = get_user_model()

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    """Creates an account for an ERP user."""

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'


class LoginView(TokenObtainPairView):
    """Login JWT com limite de tentativas por IP."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'


class MeView(generics.RetrieveAPIView):
    """Returns the authenticated user and its access profile."""

    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user


class FuncionarioViewSet(viewsets.ModelViewSet):
    """CRUD administrativo de funcionários da equipe com controle de acesso."""

    serializer_class = FuncionarioSerializer
    permission_classes = [IsAdministrador]

    def get_queryset(self):
        qs = User.objects.select_related('perfil').exclude(perfil__role='cliente').order_by('id')
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(perfil__role=role)
        return qs

    def perform_create(self, serializer):
        if not tem_permissao(self.request.user, 'GERENCIAR_USUARIOS'):
            raise PermissionDenied('Você não possui permissão para criar usuários.')
        super().perform_create(serializer)

    def perform_update(self, serializer):
        if not tem_permissao(self.request.user, 'GERENCIAR_USUARIOS'):
            raise PermissionDenied('Você não possui permissão para editar usuários.')
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if not tem_permissao(self.request.user, 'GERENCIAR_USUARIOS'):
            raise PermissionDenied('Você não possui permissão para excluir usuários.')
        super().perform_destroy(instance)


class DisponibilidadeView(APIView):
    """Controla o status de disponibilidade (Online/Offline) do entregador logado."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        perfil = getattr(request.user, 'perfil', None)
        return Response({
            'is_online': perfil.is_online if perfil else False,
            'role': perfil.role if perfil else 'cliente',
        })

    def post(self, request):
        perfil = getattr(request.user, 'perfil', None)
        if not perfil:
            return Response({'detail': 'Perfil não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        raw_status = request.data.get('is_online')
        if raw_status is None:
            is_online_val = not perfil.is_online
        elif isinstance(raw_status, str):
            is_online_val = raw_status.lower() in ('true', '1')
        else:
            is_online_val = bool(raw_status)

        # Regra de negócio: Para ficar online, o entregador deve possuir turno em aberto
        if is_online_val and perfil.role == 'entregador':
            from core.models import Turno
            tem_turno_aberto = Turno.objects.filter(user=request.user, fim__isnull=True).exists()
            if not tem_turno_aberto:
                return Response(
                    {'detail': 'Você precisa iniciar seu turno (bater ponto) antes de ficar disponível.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        perfil.is_online = is_online_val
        perfil.save(update_fields=['is_online'])

        return Response({
            'is_online': perfil.is_online,
            'message': 'Status de disponibilidade atualizado com sucesso.',
        })


class RBACMatrixView(APIView):
    """Retorna e gerencia a Matriz de Permissões (RBAC) do sistema."""

    permission_classes = [IsAdministrador]

    def get(self, request):
        roles_data = [
            {'key': key, 'label': label, 'readonly': key == 'cliente'}
            for key, label in Perfil.ROLE_CHOICES
        ]

        modulos_dict = {}
        permissoes = Permissao.objects.all().order_by('modulo', 'codigo')

        role_perm_map = {}
        for rp in RolePermissao.objects.select_related('permissao').all():
            role_perm_map.setdefault(rp.permissao_id, set()).add(rp.role_nome)

        for p in permissoes:
            if p.modulo not in modulos_dict:
                modulos_dict[p.modulo] = []

            modulos_dict[p.modulo].append({
                'id': p.id,
                'codigo': p.codigo,
                'descricao': p.descricao,
                'roles': list(role_perm_map.get(p.id, set())),
            })

        modulos_list = [
            {'modulo': mod, 'permissoes': perms}
            for mod, perms in modulos_dict.items()
        ]

        return Response({
            'roles': roles_data,
            'modulos': modulos_list,
        })

    def post(self, request):
        role = request.data.get('role')
        codigo = request.data.get('permissao_codigo')
        conceder = request.data.get('conceder')

        if not role or not codigo:
            return Response(
                {'detail': 'Campos role e permissao_codigo são obrigatórios.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_roles = [r[0] for r in Perfil.ROLE_CHOICES]
        if role not in valid_roles:
            return Response(
                {'detail': f'Perfil inválido. Opções válidas: {valid_roles}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            permissao = Permissao.objects.get(codigo=codigo)
        except Permissao.DoesNotExist:
            return Response(
                {'detail': f'Permissão {codigo} não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Bloqueio de segurança: evitar revogar GERENCIAR_USUARIOS do administrador
        if role == 'administrador' and codigo == 'GERENCIAR_USUARIOS' and conceder is False:
            return Response(
                {'detail': 'Não é permitido revogar a permissão de gerenciamento de usuários do perfil administrador.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rp = RolePermissao.objects.filter(role_nome=role, permissao=permissao).first()

        if conceder is None:
            conceder = rp is None

        if conceder:
            if not rp:
                RolePermissao.objects.create(role_nome=role, permissao=permissao)
            status_final = True
            msg = f'Permissão {codigo} concedida com sucesso para {role}.'
        else:
            if rp:
                rp.delete()
            status_final = False
            msg = f'Permissão {codigo} revogada com sucesso para {role}.'

        try:
            from core.services import registrar_auditoria
            registrar_auditoria(
                user=request.user,
                acao='ALTEROU_PERMISSAO_RBAC',
                entidade='users_rolepermissao',
                entidade_id=permissao.id,
                detalhes=msg,
            )
        except Exception:
            logger.exception('Falha ao registrar auditoria de permissoes')

        return Response({
            'role': role,
            'permissao_codigo': codigo,
            'ativo': status_final,
            'message': msg,
        })
