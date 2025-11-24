const Colecionavel = require('../models/Colecionavel');

exports.listar = async (req, res) => {
  try {
    const { categoria, ano } = req.query;
    const where = {};

    // Validação de tipo: Se passar ano, tem que ser número
    if (ano && isNaN(ano)) {
      return res.status(400).json({ error: 'O filtro "ano" deve ser um número válido.' });
    }

    if (categoria) where.categoria = categoria;
    if (ano) where.ano = ano;

    const itens = await Colecionavel.findAll({ where });
    
    // Dica para apresentação: Retornar array vazio é 200 OK, não 404.
    res.status(200).json(itens);

  } catch (error) {
    console.error("Erro ao listar:", error);
    res.status(500).json({ error: 'Erro interno ao buscar itens.' });
  }
};

exports.resumo = async (req, res) => {
  try {
    const totalItens = await Colecionavel.count();
    
    const totalCategorias = await Colecionavel.count({
      distinct: true,
      col: 'categoria'
    });

    const itemMaisAntigo = await Colecionavel.min('ano');

    res.json({
      totalItens,
      totalCategorias,
      // Se não tiver itens, itemMaisAntigo vem null, tratamos para texto
      anoMaisAntigo: itemMaisAntigo || 'Nenhum item cadastrado'
    });
  } catch (error) {
    console.error("Erro no resumo:", error);
    res.status(500).json({ error: 'Erro ao gerar dados de resumo.' });
  }
};

exports.obterPorId = async (req, res) => {
  try {
    // Validação básica se ID é numérico (opcional, dependendo do banco)
    if (isNaN(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido. Deve ser numérico.' });
    }

    const item = await Colecionavel.findByPk(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado na coleção.' });
    }
    
    res.json(item);
  } catch (error) {
    console.error("Erro ao buscar item:", error);
    res.status(500).json({ error: 'Erro interno ao buscar item.' });
  }
};

exports.criar = async (req, res) => {
  try {
    // Verificação de Segurança (Middleware falhou?)
    if (!req.usuario || !req.usuario.id) {
        return res.status(401).json({ error: 'Usuário não autenticado. Token necessário.' });
    }
    
    const idUsuarioLogado = req.usuario.id;
    const { nome, categoria, ano, condicao } = req.body;

    // 1. Validação Manual dos Campos Obrigatórios
    if (!nome || !categoria || !ano) {
      return res.status(400).json({ 
          error: 'Campos obrigatórios faltando: nome, categoria e ano.' 
      });
    }

    // 2. Validação de Lógica de Negócio (Ex: Ano futuro)
    const anoAtual = new Date().getFullYear();
    if (ano > anoAtual + 1) {
        return res.status(400).json({ error: 'O ano do item não pode ser muito no futuro.' });
    }

    const novoItem = await Colecionavel.create({
      nome,
      categoria,
      ano,
      condicao,
      usuarioId: idUsuarioLogado
    });

    res.status(201).json(novoItem);

  } catch (error) {
    console.error("Erro ao criar:", error);

    // Tratamento de Erros do Sequelize (Validações do Model)
    if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ 
            error: 'Erro de validação de dados.',
            mensagens: error.errors.map(e => e.message)
        });
    }

    res.status(500).json({ error: 'Erro interno ao criar item.' });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const idUsuarioLogado = req.usuario.id;
    const { nome, categoria, ano } = req.body; // Pega campos para validar se vierem

    const item = await Colecionavel.findByPk(req.params.id);

    if (!item) return res.status(404).json({ error: 'Item não encontrado.' });

    // Verificação de Segurança: Autorização
    if (item.usuarioId !== idUsuarioLogado) {
        // 403 Forbidden: O servidor entendeu quem você é, mas você não pode fazer isso.
        return res.status(403).json({ error: 'Você não tem permissão para alterar este item (pertence a outro usuário).' });
    }

    // Validação se o usuário tentar atualizar para dados inválidos
    if (ano && isNaN(ano)) {
        return res.status(400).json({ error: 'O ano deve ser numérico.' });
    }

    await item.update(req.body);
    res.json({ message: "Item atualizado com sucesso!", item });

  } catch (error) {
    console.error("Erro ao atualizar:", error);
    
    if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ error: 'Dados inválidos para atualização.' });
    }

    res.status(500).json({ error: 'Erro interno ao atualizar item.' });
  }
};

exports.deletar = async (req, res) => {
  try {
    const idUsuarioLogado = req.usuario.id;
    const item = await Colecionavel.findByPk(req.params.id);

    if (!item) return res.status(404).json({ error: 'Item não encontrado.' });

    // Verificação de Segurança
    if (item.usuarioId !== idUsuarioLogado) {
        return res.status(403).json({ error: 'Você não tem permissão para deletar este item.' });
    }

    await item.destroy();
    
    // 204 No Content é padrão para delete, mas retornar JSON (200) ajuda no feedback visual do Thunder Client
    res.status(200).json({ message: 'Item removido com sucesso.' });

  } catch (error) {
    console.error("Erro ao deletar:", error);
    res.status(500).json({ error: 'Erro interno ao deletar item.' });
  }
};