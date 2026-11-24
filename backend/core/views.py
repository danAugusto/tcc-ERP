from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from .models import Turno, Auditoria, Configuracao
from .serializers import TurnoSerializer, AuditoriaSerializer, ConfiguracaoSerializer
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from . import branding
from .services import iniciar_turno, encerrar_turno, confirmar_acerto_caixa, executar_rpa, obter_nome_estabelecimento, registrar_auditoria, NOME_ESTABELECIMENTO_CHAVE, dados_estabelecimento, ESTABELECIMENTO_CAMPOS
from users.permissions import IsFuncionario, IsAdministrador, tem_permissao
from users.models import Perfil


class TurnoViewSet(viewsets.ModelViewSet):
    """
    CRUD completo e ações de check-in / checkout de turnos de trabalho.
    """

    queryset = Turno.objects.all().select_related('user')
    serializer_class = TurnoSerializer
    permission_classes = [IsFuncionario]
    # Turno so muda por check-in, checkout e acerto de caixa
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        if not tem_permissao(self.request.user, 'FECHAR_CAIXA'):
            qs = qs.filter(user=self.request.user)
        user_id = self.request.query_params.get('user_id')
        data = self.request.query_params.get('data')
        abertos = self.request.query_params.get('abertos')

        if user_id:
            qs = qs.filter(user_id=user_id)
        if data:
            qs = qs.filter(inicio__date=data)
        if abertos == 'true':
            qs = qs.filter(fim__isnull=True)
        return qs

    @action(detail=False, methods=['post'], url_path='checkin')
    def checkin(self, request):
        """Inicia o turno de trabalho do usuário logado."""
        turno = iniciar_turno(request.user)
        return Response(TurnoSerializer(turno).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='checkout')
    def checkout(self, request):
        """Encerra o turno ativo do usuário logado."""
        try:
            turno = encerrar_turno(request.user)
            return Response(TurnoSerializer(turno).data, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='ativo')
    def ativo(self, request):
        """Retorna o turno ativo do usuário logado, se houver."""
        turno = Turno.objects.filter(user=request.user, fim__isnull=True).first()
        if not turno:
            return Response({'ativo': False, 'turno': None})
        return Response({'ativo': True, 'turno': TurnoSerializer(turno).data})

    @action(detail=True, methods=['post'], url_path='confirmar-acerto')
    def confirmar_acerto(self, request, pk=None):
        """Gerente confirma o acerto de caixa de um turno encerrado."""
        if not tem_permissao(request.user, 'FECHAR_CAIXA'):
            raise PermissionDenied('Você não possui permissão para confirmar acerto de caixa.')
        try:
            turno = confirmar_acerto_caixa(pk, request.user)
            return Response(TurnoSerializer(turno).data, status=status.HTTP_200_OK)
        except Turno.DoesNotExist:
            return Response({'detail': 'Turno não encontrado.'}, status=status.HTTP_404_NOT_FOUND)


class AuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """Consulta de logs e trilha de auditoria do sistema."""

    queryset = Auditoria.objects.select_related('user').all()
    serializer_class = AuditoriaSerializer
    permission_classes = [IsAdministrador]

    def get_queryset(self):
        qs = super().get_queryset()
        acao = self.request.query_params.get('acao')
        entidade = self.request.query_params.get('entidade')
        user_id = self.request.query_params.get('user_id')

        if acao:
            qs = qs.filter(acao=acao)
        if entidade:
            qs = qs.filter(entidade=entidade)
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs


class ConfiguracaoViewSet(viewsets.ModelViewSet):
    """Consulta e alteração de parâmetros globais do sistema."""

    queryset = Configuracao.objects.all()
    serializer_class = ConfiguracaoSerializer
    permission_classes = [IsAdministrador]
    http_method_names = ['get', 'patch', 'head', 'options']


class RpaExecuteView(APIView):
    """Executa uma automacao RPA real e registra a evidencia na auditoria."""

    permission_classes = [IsAdministrador]

    def post(self, request):
        task_id = request.data.get('task_id')
        try:
            resultado = executar_rpa(task_id, request.user)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(resultado, status=status.HTTP_200_OK)


class EstabelecimentoView(APIView):
    """Nome do estabelecimento (white-label): leitura publica, alteracao somente por administrador."""

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdministrador()]

    def _payload(self):
        return {'nome': obter_nome_estabelecimento(), 'logo': branding.urls_logo(), **dados_estabelecimento()}

    def get(self, request):
        return Response(self._payload())

    def patch(self, request):
        from decimal import Decimal, InvalidOperation

        erros, novos = {}, {}
        if 'nome' in request.data:
            nome = str(request.data.get('nome', '')).strip()
            if not 2 <= len(nome) <= 60:
                erros['nome'] = 'Informe um nome entre 2 e 60 caracteres.'
            else:
                novos[NOME_ESTABELECIMENTO_CHAVE] = nome
        limites_texto = {'telefone': 30, 'endereco': 200, 'cnpj': 20, 'tempo_entrega': 20, 'tempo_retirada': 20}
        for campo, limite in limites_texto.items():
            if campo in request.data:
                valor = str(request.data.get(campo) or '').strip()
                if len(valor) > limite:
                    erros[campo] = f'Use no máximo {limite} caracteres.'
                else:
                    novos[ESTABELECIMENTO_CAMPOS[campo][0]] = valor
        for campo, maximo in {'taxa_entrega': Decimal('999'), 'pedido_minimo': Decimal('9999')}.items():
            if campo in request.data:
                try:
                    valor = Decimal(str(request.data.get(campo)).replace(',', '.'))
                    if valor < 0 or valor > maximo:
                        raise InvalidOperation
                    novos[ESTABELECIMENTO_CAMPOS[campo][0]] = f'{valor:.2f}'
                except (InvalidOperation, ValueError):
                    erros[campo] = f'Informe um valor entre 0 e {maximo}.'
        if 'aceita_pedidos_online' in request.data:
            bruto = request.data.get('aceita_pedidos_online')
            ativo = bruto is True or str(bruto).strip().lower() in ('true', '1', 'sim')
            novos[ESTABELECIMENTO_CAMPOS['aceita_pedidos_online'][0]] = 'true' if ativo else 'false'
        if erros:
            return Response(erros, status=status.HTTP_400_BAD_REQUEST)

        nome_anterior = obter_nome_estabelecimento()
        for chave, valor in novos.items():
            Configuracao.objects.update_or_create(chave=chave, defaults={'valor': valor})
        if NOME_ESTABELECIMENTO_CHAVE in novos and novos[NOME_ESTABELECIMENTO_CHAVE] != nome_anterior:
            registrar_auditoria(
                request.user, 'ALTEROU_NOME_ESTABELECIMENTO', 'sys_configuracao', 0,
                f'Nome alterado de "{nome_anterior}" para "{novos[NOME_ESTABELECIMENTO_CHAVE]}"',
            )
        outros = sorted(k for k in novos if k != NOME_ESTABELECIMENTO_CHAVE)
        if outros:
            registrar_auditoria(
                request.user, 'ALTEROU_DADOS_ESTABELECIMENTO', 'sys_configuracao', 0,
                'Campos alterados: ' + ', '.join(outros),
            )
        return Response(self._payload())


class EstabelecimentoLogoView(APIView):
    """Envio (POST) e remocao (DELETE) da logo do estabelecimento; somente administrador."""

    permission_classes = [IsAdministrador]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        arquivo = request.FILES.get('logo')
        if not arquivo:
            return Response({'logo': 'Selecione uma imagem.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            branding.salvar_logo(arquivo)
        except branding.LogoInvalida as e:
            return Response({'logo': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        registrar_auditoria(request.user, 'ALTEROU_LOGO_ESTABELECIMENTO', 'sys_configuracao', 0, 'Logo enviada')
        return Response({'nome': obter_nome_estabelecimento(), 'logo': branding.urls_logo()})

    def delete(self, request):
        branding.remover_logo()
        registrar_auditoria(request.user, 'ALTEROU_LOGO_ESTABELECIMENTO', 'sys_configuracao', 0, 'Logo removida (padrão restaurado)')
        return Response({'nome': obter_nome_estabelecimento(), 'logo': None})
