# 📋 FamíliaKanban

Aplicação Kanban familiar com backend Node.js/Express e banco de dados MongoDB.

---

## 📁 Estrutura do Projeto

```
familiakanban/
├── backend/
│   ├── server.js          ← API Express + Mongoose
│   ├── package.json
│   └── .env.example       ← Copie para .env e configure
└── frontend/
    └── index.html         ← Abra no navegador
```

---

## 🚀 Como rodar

### 1. Configure o MongoDB

**Opção A — MongoDB Atlas (recomendado, gratuito)**
1. Acesse https://cloud.mongodb.com e crie uma conta
2. Crie um cluster gratuito (M0)
3. Em **Database Access**, crie um usuário com senha
4. Em **Network Access**, adicione seu IP (ou `0.0.0.0/0` para qualquer IP)
5. Clique em **Connect → Drivers** e copie a URI

**Opção B — MongoDB local**
1. Instale o MongoDB Community: https://www.mongodb.com/try/download/community
2. Inicie com `mongod`
3. Use a URI: `mongodb://localhost:27017/familiakanban`

---

### 2. Configure o Backend

```bash
cd backend

# Copie o arquivo de variáveis de ambiente
cp .env.example .env

# Edite o .env e coloque sua URI do MongoDB
nano .env   # ou abra no seu editor preferido

# Instale as dependências
npm install

# Inicie o servidor (modo desenvolvimento com hot-reload)
npm run dev

# OU em produção
npm start
```

O servidor iniciará em: **http:np//localhost:3001**

---

### 3. Abra o Frontend

**Opção simples:** Abra o arquivo `frontend/index.html` diretamente no navegador.

**Opção com servidor local (recomendado para evitar CORS):**
```bash
# Instale um servidor simples globalmente (só uma vez)
npm install -g serve

# Na pasta frontend
cd frontend
serve .
```
Acesse: **http://localhost:3000**

---

### 4. Primeiro acesso

1. Na tela de setup, crie o perfil **Administrador** com nome e senha
2. O Admin é o único que pode adicionar/remover membros
3. Adicione os demais membros da família pelo **Painel Admin** ou pela tela de login
4. Faça login clicando no seu perfil

---

## ⚙️ Configuração do Frontend

Se o backend não estiver em `localhost:3001`, edite a linha no `frontend/index.html`:

```javascript
const API = 'http://localhost:3001/api';
// Troque pelo endereço correto, ex:
// const API = 'https://meuservidor.com/api';
```

---

## 🔌 Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Status do servidor |
| GET | `/api/members` | Listar membros |
| POST | `/api/members/setup` | Criar admin (primeira vez) |
| POST | `/api/members` | Criar membro (requer senha admin) |
| POST | `/api/members/login` | Login do admin |
| DELETE | `/api/members/:id` | Remover membro |
| GET | `/api/activities` | Listar atividades (com filtros) |
| GET | `/api/activities/archive` | Arquivo morto |
| POST | `/api/activities` | Criar atividade |
| PUT | `/api/activities/:id` | Atualizar atividade |
| PATCH | `/api/activities/:id/done` | Toggle concluído |
| POST | `/api/activities/:id/comments` | Adicionar comentário |
| DELETE | `/api/activities/:id` | Excluir atividade |

---

## 📦 Funcionalidades

- ✅ **Kanban semanal** — Segunda a Domingo
- ✅ **Múltiplos dias** — uma atividade pode aparecer em vários dias via checkboxes
- ✅ **Recorrente** — repete toda semana até a vigência, depois vai para Arquivo Morto
- ✅ **Post-its coloridos** — 8 cores disponíveis
- ✅ **Concluir / Editar / Excluir** atividades
- ✅ **Comentários e notas** em cada atividade
- ✅ **Tags `#`** — classificação livre e filtragem por clique
- ✅ **Filtros** — por membro, tag, tipo e período
- ✅ **Admin com senha** — único com permissão de gerenciar membros
- ✅ **Perfis sem senha** — demais membros selecionam o nome e entram
- ✅ **Arquivo Morto** — atividades expiradas ficam acessíveis para reativação
- ✅ **Persistência MongoDB** — todos os dados salvos no banco

---

## 🛠️ Tecnologias

- **Frontend:** HTML, CSS, JavaScript puro (sem framework)
- **Backend:** Node.js, Express.js
- **Banco de dados:** MongoDB com Mongoose
- **Segurança:** bcryptjs para hash de senhas
