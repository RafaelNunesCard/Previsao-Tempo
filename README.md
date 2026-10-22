# Áureo — Previsão do Tempo

Aplicação web que consulta uma **API pública** de clima, recebe os dados em
**JSON**, processa e apresenta as informações de forma dinâmica ao usuário.

O backend é escrito em **PHP**: é ele quem faz a requisição HTTP para a API
pública (por meio de `cURL` ou `file_get_contents`), interpreta o JSON e o
devolve tratado para o navegador. O frontend cuida da apresentação (interface,
mapa, gráfico e visualização do JSON).

---

## Como usar

1. Digite o nome de uma cidade no campo de pesquisa (ex.: `Lisboa`, `São Paulo`).
2. Clique no botão **[ Consultar ]** (ou escolha uma sugestão que aparece).
3. O PHP consulta a API pública e a página apresenta os resultados:
   temperatura atual, condição do tempo, umidade, vento e hora local.
4. Navegue pelas abas: **Mapa**, **Gráfico** e **JSON**.

### Recursos extras
- **Mapa interativo** (Leaflet): clique em qualquer ponto do mapa para ver o clima do local.
- **Gráfico de temperatura** (Chart.js): histórico dos últimos 2 dias + previsão dos próximos 5 dias.
- **Onde está nevando?**: consulta o clima atual de várias cidades do mundo e marca no mapa as que estão com neve.
- **Aba JSON**: mostra o JSON bruto retornado pela API pública.

---

## API pública utilizada

| Finalidade            | API                                                            |
| --------------------- | -------------------------------------------------------------- |
| Buscar cidade         | Open-Meteo Geocoding — `https://geocoding-api.open-meteo.com/v1/search` |
| Clima / previsão      | Open-Meteo Forecast — `https://api.open-meteo.com/v1/forecast` |
| Nome de um ponto      | Nominatim (OpenStreetMap) — `https://nominatim.openstreetmap.org/reverse` |

Nenhuma das APIs exige chave de acesso (gratuitas e públicas).

---

## Arquitetura

```
Navegador (index.html + script.js)
        │  fetch("api.php?action=...")
        ▼
   api.php  (PHP)  ── busca dados JSON ──►  API pública (Open-Meteo / Nominatim)
        │  devolve JSON processado
        ▼
Navegador renderiza os resultados
```

O arquivo `api.php` expõe as seguintes ações (`?action=`):

| Ação      | Parâmetros          | Descrição                                   |
| --------- | ------------------- | ------------------------------------------- |
| `geocode` | `q`                 | Busca cidades por nome                      |
| `weather` | `latitude`, `longitude` | Clima atual + histórico + previsão      |
| `reverse` | `latitude`, `longitude` | Descobre o nome de um ponto no mapa     |
| `snow`    | `latitude`, `longitude` (listas) | Clima atual de várias cidades |

---

## Estrutura de arquivos

```
Previsao-Tempo/
├── api.php        # Backend PHP: faz as requisições às APIs públicas
├── index.html     # Página inicial: título, formulário, campo de pesquisa, botão e área de resultados
├── script.js      # Frontend: chama o api.php e apresenta os dados dinamicamente
├── style.css      # Estilos da interface
├── serve.bat      # Atalho para iniciar o servidor PHP no Windows
└── README.md
```

---

## Como executar

O projeto precisa de **PHP** instalado (o HTML estático não é suficiente, pois a
consulta à API é feita pelo PHP).

### Opção 1 — Windows (atalho pronto)

Dê um duplo-clique em **`serve.bat`** e acesse: <http://localhost:8000>

### Opção 2 — Linha de comando (qualquer sistema)

Na pasta do projeto, execute:

```bash
php -S localhost:8000
```

Depois abra <http://localhost:8000> no navegador.

> Também funciona em ambientes como **XAMPP / WAMP / Laragon**: basta copiar a
> pasta para o diretório público (`htdocs` / `www`) e acessar via `localhost`.

### Requisitos do PHP

Para que o PHP consiga acessar as APIs via **HTTPS**, é necessário que UMA das
opções abaixo esteja habilitada no `php.ini`:

- extensão **`curl`** (`extension=curl`), **ou**
- extensão **`openssl`** (`extension=openssl`) + `allow_url_fopen=On`.

O `api.php` usa `cURL` quando disponível e, caso contrário, `file_get_contents`.
O `serve.bat` já habilita essas extensões automaticamente a partir da pasta
`ext` do PHP.

---

## Requisitos da atividade — checklist

- [x] Aplicação web com requisição HTTP para uma **API pública**
- [x] Recebe os dados em formato **JSON**
- [x] Processa os dados e apresenta **dinamicamente** ao usuário
- [x] O usuário informa um dado para pesquisa
- [x] O **PHP** é quem consulta a API pública
- [x] **Página inicial** com: título do sistema, formulário, campo de pesquisa,
      botão de consulta e área para apresentação dos resultados
- [x] Código publicado no GitHub com este **README**
- [x] Vídeo no YouTube demonstrando o site funcionando *(entrega individual)*

---

## Tecnologias

- **PHP** (backend / requisições HTTP)
- HTML5, CSS3 e JavaScript (frontend)
- [Leaflet](https://leafletjs.com/) — mapa interativo
- [Chart.js](https://www.chartjs.org/) — gráfico de temperatura
- [Remix Icon](https://remixicon.com/) — ícones
- APIs públicas **Open-Meteo** e **Nominatim / OpenStreetMap**
