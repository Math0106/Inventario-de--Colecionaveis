const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario'); 

exports.criarUsuario = async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    // 1. Validação de Entrada Básica
    if (!nome || !email || !senha) {
      return res.status(400).json({ 
        message: "Dados incompletos. Os campos 'nome', 'email' e 'senha' são obrigatórios." 
      });
    }

    // 2. Verificar duplicidade manualmente (para garantir mensagem personalizada)
    const usuarioExistente = await Usuario.findOne({ where: { email } });
    if (usuarioExistente) {
      return res.status(409).json({ // 409 Conflict é o status HTTP ideal para duplicidade
        message: "Este e-mail já está cadastrado no sistema." 
      });
    }

    // 3. Criptografia da senha
    const senhaCriptografada = bcrypt.hashSync(senha, 10);

    // 4. Criação no Banco
    const novoUsuario = await Usuario.create({
      nome,
      email,
      senha: senhaCriptografada
    });

    res.status(201).json({
      message: "Usuário criado com sucesso!",
      usuario: {
        id: novoUsuario.id,
        nome: novoUsuario.nome,
        email: novoUsuario.email
      }
    });

  } catch (error) {
    console.error("Erro no cadastro:", error);

    // 5. Tratamento de erros específicos do Sequelize
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        message: "Erro de validação dos dados.",
        detalhes: error.errors.map(e => e.message) 
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: "E-mail já existente (Restrição do Banco)." });
    }

    // Erro Genérico
    res.status(500).json({ 
      message: "Erro interno ao criar usuário.",
      erroOriginal: error.message // Útil para debug na apresentação
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body;
    const JWT_SECRET = process.env.JWT_SECRET;

    // 1. Validação de Entrada
    if (!email || !senha) {
      return res.status(400).json({ message: "É necessário fornecer email e senha." });
    }

    // 2. Validação de Variável de Ambiente (Evita crash se esquecer o .env)
    if (!JWT_SECRET) {
      console.error("ERRO CRÍTICO: JWT_SECRET não definido no .env");
      return res.status(500).json({ message: "Erro de configuração no servidor." });
    }

    // 3. Buscar Usuário
    const usuario = await Usuario.findOne({ where: { email } });
    
    // Segurança: Mensagem genérica em produção, mas específica para testes acadêmicos
    if (!usuario) {
      return res.status(401).json({ message: "Usuário não encontrado." });
    }

    // 4. Validar Senha
    const senhaValida = bcrypt.compareSync(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ message: "Senha incorreta." });
    }

    // 5. Gerar Token
    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: "Login realizado com sucesso!",
      token: token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome
      }
    });

  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ 
      message: "Erro interno ao realizar login.", 
      erroOriginal: error.message 
    });
  }
};
//