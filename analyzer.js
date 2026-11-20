//#ANALYZER-START
/* ============================================================
   Repo Atlas — analyzer. Pure JS, runs in browser or node 18+.
   analyzeRepo(input, opts, onProgress) -> architecture model
   ============================================================ */
const LANG = {js:'JavaScript',jsx:'JavaScript',mjs:'JavaScript',cjs:'JavaScript',ts:'TypeScript',tsx:'TypeScript',mts:'TypeScript',cts:'TypeScript',
  vue:'Vue',svelte:'Svelte',astro:'Astro',py:'Python',go:'Go',rs:'Rust',java:'Java',kt:'Kotlin',kts:'Kotlin',scala:'Scala',rb:'Ruby',php:'PHP',
  cs:'C#',fs:'F#',swift:'Swift',dart:'Dart',ex:'Elixir',exs:'Elixir',erl:'Erlang',clj:'Clojure',lua:'Lua',c:'C',h:'C',cc:'C++',cpp:'C++',cxx:'C++',hpp:'C++',
  m:'Objective-C',mm:'Objective-C',sql:'SQL',proto:'Protobuf',graphql:'GraphQL',gql:'GraphQL',prisma:'Prisma',tf:'Terraform',html:'HTML',htm:'HTML',
  css:'CSS',scss:'CSS',sass:'CSS',less:'CSS'};
const SOURCE_EXT = new Set(Object.keys(LANG));
const SCAN_EXT = new Set('js jsx mjs cjs ts tsx mts cts vue svelte astro py go rs java kt kts scala rb php cs dart c h cc cpp cxx hpp sql prisma'.split(' '));
const ASSET_EXT = new Set('png jpg jpeg gif svg ico webp avif woff woff2 ttf eot otf mp4 mp3 wav pdf zip gz tar tgz jar class exe dll so dylib bin wasm lock map snap psd ai sketch bmp'.split(' '));
const DOC_EXT = new Set(['md','rst','txt','adoc','mdx']);
const CONF_EXT = new Set(['json','yml','yaml','toml','ini','cfg','env','xml','properties','conf','gradle','csproj']);
const IGN_RE = /(^|\/)(node_modules|vendor|dist|build|target|\.git|\.next|\.nuxt|\.svelte-kit|\.output|__pycache__|\.venv|venv|coverage|third_party|thirdparty|bower_components|\.gradle|Pods|\.idea|\.vscode|generated|__generated__|migrations?|site-packages|\.turbo|\.cache|storybook-static)(\/|$)/i;
const TEST_RE = /(^|\/)(tests?|__tests__|spec|specs|e2e|cypress|playwright|__mocks__|__snapshots__|fixtures|testdata|testing|integration-tests?)(\/|$)|\.(test|spec|stories)\.[a-z]+$|_test\.(go|py|rb)$|(^|\/)test_[^\/]*\.py$|(^|\/)conftest\.py$|Tests?\.(java|kt|cs)$/i;
const AUX_NAME = /^(docs?|documentation|examples?|samples?|demos?|benchmarks?|scripts?|tools|playground|website-docs|\.github|\.circleci|\.husky)$/i;
const AUX_BLOCK = /^(src|main|java|kotlin|scala|lib|app|org|com|net|io|packages)$/i;
function isAux(path){ const segs=path.split('/').slice(0,-1); for(let i=0;i<Math.min(segs.length,3);i++){ if(AUX_NAME.test(segs[i]) && !segs.slice(0,i).some(x=>AUX_BLOCK.test(x)&&x.toLowerCase()!=='packages')) return true; } return false; }
const CFGNAME_RE = /(^|\/)([^\/]*\.config|setup|babel\.config|gulpfile|Gruntfile|jest\.setup|vitest\.setup|setupTests|tailwind\.config|postcss\.config|karma\.conf|webpack\.[\w.]*|rollup\.[\w.]*|\.eslintrc|\.prettierrc|noxfile|fabfile|tasks)\.(js|cjs|mjs|ts|py)$/;
const MANIFESTS = new Set(['package.json','pyproject.toml','setup.py','go.mod','Cargo.toml','pom.xml','build.gradle','build.gradle.kts','Gemfile','composer.json','pubspec.yaml','mix.exs','requirements.txt','Pipfile']);
const COMPONENT_MANIFESTS = new Set(['package.json','pyproject.toml','go.mod','Cargo.toml','pom.xml','build.gradle','build.gradle.kts','composer.json','pubspec.yaml','mix.exs']);

const base = p => p.split('/').pop();
const dirOf = p => { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); };
const extOf = p => { const b = base(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1).toLowerCase() : ''; };
function normPath(p){ const out=[]; for(const s of p.split('/')){ if(s===''||s==='.')continue; if(s==='..')out.pop(); else out.push(s);} return out.join('/'); }

function classify(path){
  const ext = extOf(path), b = base(path);
  if (IGN_RE.test(path) || ASSET_EXT.has(ext) || /\.min\.(js|css)$/.test(b) || b.endsWith('.d.ts')) return 'ignored';
  if (TEST_RE.test(path)) return 'test';
  if (isAux(path)) return 'aux';
  if (CFGNAME_RE.test(path)) return 'config';
  if (SOURCE_EXT.has(ext)) return 'source';
  if (DOC_EXT.has(ext)) return 'doc';
  if (CONF_EXT.has(ext) || /^(Dockerfile|Makefile|Procfile|Jenkinsfile)/.test(b)) return 'config';
  return 'other';
}

/* ---------------- technology catalogue ---------------- */
// [regex (full match on normalised name), label, category]
const TECH_RAW = [
 // backend frameworks
 ['express','Express','framework'],['fastify','Fastify','framework'],['koa','Koa','framework'],['@hapi/hapi|hapi','Hapi','framework'],['@nestjs/.*','NestJS','framework'],
 ['next','Next.js','framework'],['nuxt|nuxt3','Nuxt','framework'],['@remix-run/.*','Remix','framework'],['@sveltejs/kit','SvelteKit','framework'],['astro','Astro','framework'],['gatsby','Gatsby','framework'],
 ['django|django-.*','Django','framework'],['flask|flask-.*','Flask','framework'],['fastapi','FastAPI','framework'],['starlette','Starlette','framework'],['tornado','Tornado','framework'],['aiohttp','aiohttp','framework'],['sanic','Sanic','framework'],['streamlit','Streamlit','framework'],['gradio','Gradio','framework'],
 ['rails|railties|actionpack','Rails','framework'],['sinatra','Sinatra','framework'],['illuminate.*|laravel/framework','Laravel','framework'],['symfony/.*|symfony\\\\.*','Symfony','framework'],
 ['org\\.springframework.*|spring-boot.*|spring-.*','Spring','framework'],['io\\.quarkus.*|quarkus-.*','Quarkus','framework'],['io\\.micronaut.*','Micronaut','framework'],
 ['github\\.com/gin-gonic/gin','Gin','framework'],['github\\.com/labstack/echo.*','Echo','framework'],['github\\.com/gofiber/fiber.*','Fiber','framework'],['github\\.com/go-chi/chi.*','chi','framework'],['github\\.com/gorilla/mux','gorilla/mux','framework'],
 ['actix-web|actix-rt','Actix','framework'],['axum','Axum','framework'],['rocket','Rocket','framework'],['warp','Warp','framework'],['tokio','Tokio','framework'],
 ['microsoft\\.aspnetcore.*|microsoft\\.asp.*','ASP.NET','framework'],['electron','Electron','framework'],['@tauri-apps/.*|tauri','Tauri','framework'],['react-native|expo','React Native','frontend'],
 // frontend
 ['react|react-dom','React','frontend'],['vue','Vue','frontend'],['svelte','Svelte','frontend'],['@angular/core','Angular','frontend'],['solid-js','Solid','frontend'],['preact','Preact','frontend'],['lit|lit-element','Lit','frontend'],
 ['jquery','jQuery','frontend'],['htmx\\.org','htmx','frontend'],['alpinejs','Alpine.js','frontend'],['tailwindcss','Tailwind CSS','ui'],['bootstrap','Bootstrap','ui'],['@mui/.*','MUI','ui'],['@chakra-ui/.*','Chakra UI','ui'],['antd','Ant Design','ui'],['@radix-ui/.*','Radix UI','ui'],
 ['redux|@reduxjs/toolkit|react-redux','Redux','state'],['zustand','Zustand','state'],['mobx','MobX','state'],['pinia','Pinia','state'],['vuex','Vuex','state'],['@tanstack/react-query|react-query','TanStack Query','state'],['swr','SWR','state'],
 ['@apollo/client|apollo-client','Apollo Client','api'],['urql','urql','api'],['graphql|graphql-.*','GraphQL','api'],['@apollo/server|apollo-server.*','Apollo Server','api'],['type-graphql|graphene','GraphQL server','api'],['@trpc/.*','tRPC','api'],['@grpc/.*|grpcio|grpcio-.*|google\\.golang\\.org/grpc','gRPC','api'],['swagger.*|drf-yasg|flask-restx','OpenAPI/Swagger','api'],
 ['vite','Vite','build'],['webpack|webpack-cli','webpack','build'],['rollup','Rollup','build'],['esbuild','esbuild','build'],['parcel','Parcel','build'],['turbo','Turborepo','build'],['nx|@nrwl/.*|@nx/.*','Nx','build'],['lerna','Lerna','build'],['typescript','TypeScript','build'],['babel|@babel/.*','Babel','build'],
 // data
 ['pg|postgres|psycopg2|psycopg2-binary|psycopg|asyncpg|pgx|github\\.com/jackc/pgx.*|github\\.com/lib/pq|org\\.postgresql.*|npgsql.*|tokio-postgres|@vercel/postgres|postgresql|pg-promise','PostgreSQL','database'],
 ['mysql|mysql2|pymysql|mysqlclient|mysql-connector-python|github\\.com/go-sql-driver/mysql|com\\.mysql.*|mysql-connector-java','MySQL','database'],['mariadb','MariaDB','database'],
 ['mongodb|mongoose|pymongo|motor|mongoengine|beanie|go\\.mongodb\\.org/.*|org\\.mongodb.*|com\\.mongodb.*','MongoDB','database'],
 ['sqlite3|better-sqlite3|aiosqlite|sqlite|github\\.com/mattn/go-sqlite3|@libsql/client|rusqlite','SQLite','database'],
 ['@supabase/supabase-js|supabase','Supabase','database'],['firebase|firebase-admin|@firebase/.*|firebase_admin','Firebase','database'],['cassandra-driver','Cassandra','database'],['neo4j-driver|neo4j','Neo4j','database'],['@planetscale/database','PlanetScale','database'],['clickhouse-.*|@clickhouse/.*','ClickHouse','database'],['@aws-sdk/client-dynamodb|@aws-sdk/lib-dynamodb','DynamoDB','database'],['@neondatabase/.*','Neon','database'],['@prisma/client|prisma','Prisma ORM','orm'],
 ['typeorm','TypeORM','orm'],['sequelize','Sequelize','orm'],['knex','Knex','orm'],['drizzle-orm','Drizzle','orm'],['sqlalchemy|alembic','SQLAlchemy','orm'],['peewee','Peewee','orm'],['tortoise-orm','Tortoise ORM','orm'],['sqlmodel','SQLModel','orm'],['gorm\\.io/.*','GORM','orm'],['diesel|sqlx|sea-orm','Rust SQL','orm'],['hibernate.*|org\\.hibernate.*|jakarta\\.persistence.*|javax\\.persistence.*','Hibernate/JPA','orm'],['microsoft\\.entityframeworkcore.*','EF Core','orm'],
 ['redis|ioredis|@upstash/redis|aioredis|redis-py|github\\.com/(redis/go-redis|go-redis/redis).*|redis\\.clients\\..*|io\\.lettuce.*|stackexchange\\.redis','Redis','cache'],['memcached|pymemcache|memjs','Memcached','cache'],
 ['bullmq|bull|bee-queue','BullMQ (Redis queue)','queue'],['amqplib|pika|aio-pika|kombu|github\\.com/(rabbitmq/amqp091-go|streadway/amqp)|com\\.rabbitmq.*|lapin','RabbitMQ','queue'],['celery','Celery','queue'],['rq|dramatiq|huey','Task queue (Python)','queue'],
 ['kafkajs|confluent-kafka|kafka-python|aiokafka|github\\.com/(ibm|shopify)/sarama|github\\.com/segmentio/kafka-go|org\\.apache\\.kafka.*|rdkafka','Kafka','queue'],['nats|nats\\.js|nats-py|github\\.com/nats-io/.*','NATS','queue'],
 ['sidekiq|resque|delayed_job','Sidekiq/Resque','queue'],['inngest','Inngest','queue'],['@temporalio/.*|temporalio|go\\.temporal\\.io/.*','Temporal','queue'],['@aws-sdk/client-sqs','AWS SQS','queue'],['apscheduler|node-cron|agenda|node-schedule|cron','Scheduler','queue'],
 ['elasticsearch|@elastic/elasticsearch|org\\.elasticsearch.*|elastic-transport','Elasticsearch','search'],['opensearch-py|@opensearch-project/.*','OpenSearch','search'],['algoliasearch','Algolia','search'],['meilisearch','Meilisearch','search'],['typesense','Typesense','search'],
 ['boto3|botocore|aws-sdk|@aws-sdk/.*|software\\.amazon\\.awssdk.*|com\\.amazonaws.*|github\\.com/aws/aws-sdk-go.*|aws-config|rusoto.*','AWS','cloud'],['@aws-sdk/client-s3|minio|@google-cloud/storage|azure-storage-blob|@azure/storage-blob|cloudinary|@uploadthing/.*|uploadthing','Object storage','storage'],
 ['google-cloud-.*|@google-cloud/.*|google\\.cloud.*|cloud\\.google\\.com/go.*','Google Cloud','cloud'],['azure-.*|@azure/.*|microsoft\\.azure.*|azure\\..*','Azure','cloud'],['@vercel/.*','Vercel','cloud'],['@cloudflare/.*|wrangler|miniflare','Cloudflare','cloud'],['@netlify/.*','Netlify','cloud'],
 // auth
 ['passport|passport-.*','Passport','auth'],['jsonwebtoken|jose|pyjwt|python-jose|github\\.com/golang-jwt/.*|io\\.jsonwebtoken.*','JWT','auth'],['next-auth|@auth/.*|authlib|lucia|better-auth','Auth library','auth'],['@clerk/.*','Clerk','auth'],['@auth0/.*|auth0|auth0-python','Auth0','auth'],['keycloak.*|python-keycloak|org\\.keycloak.*','Keycloak','auth'],['bcrypt|bcryptjs|argon2|passlib','Password hashing','auth'],['devise|omniauth','Devise/OmniAuth','auth'],['supertokens-.*','SuperTokens','auth'],['oauthlib|requests-oauthlib|django-allauth|social-auth-.*','OAuth','auth'],
 // ai
 ['openai','OpenAI','ai'],['@anthropic-ai/sdk|anthropic','Anthropic','ai'],['langchain|langchain-.*|@langchain/.*|langgraph|llama-index.*|llamaindex','LangChain / LlamaIndex','ai'],['@google/generative-ai|google-generativeai|google-genai','Google Gemini','ai'],['transformers|huggingface-hub|huggingface_hub|@huggingface/.*|sentence-transformers','Hugging Face','ai'],['torch|pytorch|tensorflow|keras|scikit-learn|sklearn|jax|xgboost','ML framework','ai'],['ollama','Ollama','ai'],['cohere','Cohere','ai'],['ai|@ai-sdk/.*','Vercel AI SDK','ai'],['chromadb|pinecone-client|@pinecone-database/pinecone|weaviate-client|qdrant-client|pgvector|faiss-cpu|lancedb','Vector DB','ai'],
 ['stripe|@stripe/.*|stripe-.*|com\\.stripe.*','Stripe','payments'],['paypal.*|@paypal/.*|braintree|razorpay|@lemonsqueezy/.*|paddle.*','Payments','payments'],
 ['@sentry/.*|sentry-sdk|sentry_sdk|sentry-.*|io\\.sentry.*','Sentry','monitoring'],['datadog|dd-trace|ddtrace|datadog-.*','Datadog','monitoring'],['newrelic|new-relic','New Relic','monitoring'],['prom-client|prometheus-client|prometheus_client|github\\.com/prometheus/.*|micrometer.*','Prometheus','monitoring'],['@opentelemetry/.*|opentelemetry.*|go\\.opentelemetry\\.io/.*','OpenTelemetry','monitoring'],['bugsnag|@bugsnag/.*|rollbar|honeybadger','Error tracking','monitoring'],['posthog-.*|posthog|mixpanel|@segment/.*|analytics-node|amplitude.*','Product analytics','monitoring'],
 ['nodemailer|@sendgrid/.*|sendgrid|mailgun.*|postmark.*|resend|@react-email/.*|emails|flask-mail|django-anymail|ses','Email','email'],['twilio','Twilio (SMS/voice)','email'],
 ['socket\\.io|socket\\.io-client|ws|websockets|pusher|pusher-js|ably|channels|django-channels|action_cable|actioncable','WebSockets / realtime','realtime'],
 // misc libs (tags)
 ['axios|node-fetch|got|undici|requests|httpx|urllib3|reqwest|ky|superagent|okhttp.*','HTTP client','http'],['winston|pino|bunyan|loguru|structlog|logrus|zap|go\\.uber\\.org/zap|slog|log4j.*|logback.*|tracing','Logging','logging'],
 ['jest|vitest|mocha|pytest|cypress|@playwright/test|playwright|junit.*|testify|rspec|phpunit|supertest|@testing-library/.*','Testing','test'],
 ['zod|joi|yup|pydantic|class-validator|ajv|marshmallow','Validation','util'],['lodash|underscore|ramda|date-fns|dayjs|moment|numpy|pandas|scipy','Utilities','util'],
 ['celery-beat','Celery','queue'],['gunicorn|uvicorn|hypercorn|waitress|puma|unicorn','App server','framework'],['alembic','Alembic migrations','orm'],['docker','Docker SDK','infra']
];
const TECH = TECH_RAW.map(([p,l,c]) => ({re:new RegExp('^(?:'+p+')$'), label:l, cat:c}));
const SERVICE_CATS = new Set(['database','cache','queue','search','storage','cloud','auth','ai','payments','monitoring','email','realtime','gateway']);
const DOCKER_IMAGES = [
 [/(^|\/)(postgres|postgresql|pgvector|timescaledb|supabase\/postgres|postgis)/i,'PostgreSQL','database'],[/(^|\/)mysql/i,'MySQL','database'],[/(^|\/)mariadb/i,'MariaDB','database'],[/(^|\/)mongo/i,'MongoDB','database'],
 [/(^|\/)(redis|valkey|keydb)/i,'Redis','cache'],[/memcached/i,'Memcached','cache'],[/rabbitmq/i,'RabbitMQ','queue'],[/(kafka|redpanda)/i,'Kafka','queue'],[/(^|\/)nats/i,'NATS','queue'],[/zookeeper/i,'ZooKeeper','queue'],
 [/elasticsearch/i,'Elasticsearch','search'],[/opensearch/i,'OpenSearch','search'],[/meilisearch/i,'Meilisearch','search'],[/typesense/i,'Typesense','search'],[/minio/i,'MinIO','storage'],[/localstack/i,'AWS','cloud'],
 [/clickhouse/i,'ClickHouse','database'],[/cassandra/i,'Cassandra','database'],[/neo4j/i,'Neo4j','database'],[/influxdb/i,'InfluxDB','database'],
 [/(^|\/)(nginx|traefik|caddy|haproxy|envoy|kong)/i,'Gateway / proxy','gateway'],[/keycloak/i,'Keycloak','auth'],[/(mailhog|mailpit|maildev)/i,'Email','email'],[/(prometheus|grafana|jaeger|loki|otel|opentelemetry)/i,'Prometheus','monitoring']
];
const techCache = new Map();
function techFor(name){
  const n = name.toLowerCase().replace(/_/g,'-');
  if (techCache.has(n)) return techCache.get(n);
  let r = null;
  for (const t of TECH) if (t.re.test(n)) { r = t; break; }
  techCache.set(n, r); return r;
}

/* ---------------- tiny YAML ---------------- */
function parseYaml(text){
  const lines = text.replace(/\t/g,'  ').split('\n').map(l=>l.replace(/(^|\s)#.*$/,'').replace(/\s+$/,'')).filter(l=>l.trim()!==''&&l.trim()!=='---'&&!l.startsWith('%'));
  let i = 0;
  const ind = l => l.match(/^ */)[0].length;
  const splitTop = s => { const out=[]; let d=0,cur='',q=null; for(const ch of s){ if(q){cur+=ch; if(ch===q)q=null; continue;} if(ch==='"'||ch==="'"){q=ch;cur+=ch;continue;} if(ch==='['||ch==='{')d++; if(ch===']'||ch==='}')d--; if(ch===','&&d===0){out.push(cur);cur='';} else cur+=ch;} if(cur.trim())out.push(cur); return out; };
  function scalar(s){
    s = s.trim();
    let m = s.match(/^(['"])([\s\S]*)\1$/); if (m) return m[2];
    if (s==='true') return true; if (s==='false') return false; if (s==='null'||s==='~') return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return +s;
    if (s[0]==='['&&s.endsWith(']')) return splitTop(s.slice(1,-1)).map(scalar);
    if (s[0]==='{'&&s.endsWith('}')) { const o={}; for(const kv of splitTop(s.slice(1,-1))){ const j=kv.indexOf(':'); if(j>0)o[kv.slice(0,j).trim()]=scalar(kv.slice(j+1)); } return o; }
    return s;
  }
  const isItem = l => /^-(\s|$)/.test(l.trim());
  function block(){
    if (i>=lines.length) return null;
    const n = ind(lines[i]);
    return isItem(lines[i]) ? list(n) : map(n);
  }
  function list(n){
    const arr = [];
    while (i<lines.length && ind(lines[i])===n && isItem(lines[i])) {
      const c = lines[i].trim().slice(1).trim();
      if (c==='') { i++; arr.push(i<lines.length&&ind(lines[i])>n ? block() : null); }
      else if (/^("[^"]*"|'[^']*'|[\w.\-\/$]+):(\s|$)/.test(c)) { lines[i] = ' '.repeat(n+2)+c; arr.push(map(n+2)); }
      else { i++; arr.push(scalar(c)); }
    }
    return arr;
  }
  function map(n){
    const o = {};
    while (i<lines.length && ind(lines[i])===n && !isItem(lines[i])) {
      const m = lines[i].trim().match(/^("[^"]*"|'[^']*'|[^:]+?):(?:\s+(.*))?$/);
      if (!m) { i++; continue; }
      const key = m[1].replace(/^["']|["']$/g,''); const rest = m[2]; i++;
      if (rest===undefined||rest==='') {
        if (i<lines.length && (ind(lines[i])>n || (ind(lines[i])===n && isItem(lines[i])))) o[key] = block(); else o[key] = null;
      } else if (/^[|>][+-]?$/.test(rest)) {
        const buf=[]; while(i<lines.length && ind(lines[i])>n) buf.push(lines[i++].trim()); o[key]=buf.join('\n');
      } else o[key] = scalar(rest);
    }
    return o;
  }
  try { return block() || {}; } catch(e){ return {}; }
}

/* ---------------- manifest parsers ---------------- */
function parseManifest(path, text){
  const b = base(path), out = {path, eco:null, name:null, deps:[], devDeps:[], extra:{}};
  try {
    if (b==='package.json') {
      const j = JSON.parse(text); out.eco='npm'; out.name=j.name||null;
      out.deps = Object.keys(j.dependencies||{}).concat(Object.keys(j.peerDependencies||{})); out.devDeps = Object.keys(j.devDependencies||{});
      out.extra = {scripts:j.scripts||{}, main:j.main, bin:j.bin, workspaces:Array.isArray(j.workspaces)?j.workspaces:(j.workspaces&&j.workspaces.packages)||null, version:j.version, description:j.description, private:j.private};
    } else if (/^requirements.*\.txt$/.test(b)) {
      out.eco='pip'; out.deps = text.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')&&!l.startsWith('-')).map(l=>(l.match(/^[A-Za-z0-9_.\-]+/)||[''])[0]).filter(Boolean);
    } else if (b==='pyproject.toml') {
      out.eco='pip'; out.name=(text.match(/^\s*name\s*=\s*["']([^"']+)["']/m)||[])[1]||null;
      const names=new Set();
      for (const m of text.matchAll(/(?:^|\n)\s*(?:dependencies|requires)\s*=\s*\[([\s\S]*?)\]/g)) for (const s of m[1].matchAll(/["']([A-Za-z0-9_.\-]+)/g)) names.add(s[1]);
      const poetry = text.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\n\[|$)/); if (poetry) for (const m of poetry[1].matchAll(/^\s*([A-Za-z0-9_.\-]+)\s*=/gm)) if (m[1]!=='python') names.add(m[1]);
      out.deps=[...names];
      const sc=text.match(/\[project\.scripts\]([\s\S]*?)(?=\n\[|$)/); if(sc) out.extra.scripts=Object.fromEntries([...sc[1].matchAll(/^\s*([\w.\-]+)\s*=\s*["']([^"']+)/gm)].map(m=>[m[1],m[2]]));
    } else if (b==='Pipfile') {
      out.eco='pip'; const m=text.match(/\[packages\]([\s\S]*?)(?=\n\[|$)/); if(m) out.deps=[...m[1].matchAll(/^\s*([A-Za-z0-9_.\-]+)\s*=/gm)].map(x=>x[1]);
    } else if (b==='setup.py') {
      out.eco='pip'; const m=text.match(/install_requires\s*=\s*\[([\s\S]*?)\]/); if(m) out.deps=[...m[1].matchAll(/["']([A-Za-z0-9_.\-]+)/g)].map(x=>x[1]);
    } else if (b==='go.mod') {
      out.eco='go'; out.name=(text.match(/^module\s+(\S+)/m)||[])[1]||null;
      for (const m of text.matchAll(/require\s*\(([\s\S]*?)\)/g)) for (const l of m[1].split('\n')) { const t=l.trim().split(/\s+/)[0]; if(t&&!t.startsWith('//')) out.deps.push(t); }
      for (const m of text.matchAll(/^require\s+(\S+)\s+v/gm)) out.deps.push(m[1]);
    } else if (b==='Cargo.toml') {
      out.eco='cargo'; out.name=(text.match(/\[package\][\s\S]*?name\s*=\s*"([^"]+)"/)||[])[1]||null;
      for (const sec of text.matchAll(/\[(?:[\w-]+\.)?dependencies\]([\s\S]*?)(?=\n\[|$)/g)) for (const m of sec[1].matchAll(/^\s*([A-Za-z0-9_\-]+)\s*=/gm)) out.deps.push(m[1]);
      const ws=text.match(/members\s*=\s*\[([\s\S]*?)\]/); if(ws) out.extra.workspaces=[...ws[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
    } else if (b==='Gemfile') {
      out.eco='gem'; out.deps=[...text.matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm)].map(m=>m[1]);
    } else if (b==='pom.xml') {
      out.eco='maven'; out.name=(text.match(/<artifactId>([^<]+)<\/artifactId>/)||[])[1]||null;
      for (const m of text.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) { const g=(m[1].match(/<groupId>([^<]+)/)||[])[1], a=(m[1].match(/<artifactId>([^<]+)/)||[])[1]; if(a) out.deps.push(a); if(g) out.deps.push(g); }
    } else if (/^build\.gradle/.test(b)) {
      out.eco='gradle'; for (const m of text.matchAll(/['"]([\w.\-]+):([\w.\-]+)(?::[^'"]*)?['"]/g)) { out.deps.push(m[2]); out.deps.push(m[1]); }
    } else if (b==='composer.json') {
      const j=JSON.parse(text); out.eco='composer'; out.name=j.name||null; out.deps=Object.keys(j.require||{}); out.devDeps=Object.keys(j['require-dev']||{});
    } else if (b==='pubspec.yaml') {
      const y=parseYaml(text); out.eco='pub'; out.name=y.name||null; out.deps=Object.keys(y.dependencies||{});
    } else if (b==='mix.exs') {
      out.eco='hex'; out.deps=[...text.matchAll(/\{:(\w+),/g)].map(m=>m[1]);
    } else if (b.endsWith('.csproj')) {
      out.eco='nuget'; out.deps=[...text.matchAll(/PackageReference\s+Include="([^"]+)"/g)].map(m=>m[1]);
    }
  } catch(e){}
  return out;
}

/* ---------------- source scanning ---------------- */
const NODE_BUILTIN = new Set('assert buffer child_process cluster crypto dgram dns events fs http http2 https net os path perf_hooks process querystring readline stream string_decoder timers tls tty url util v8 vm worker_threads zlib module console constants'.split(' '));
const PY_STDLIB = new Set('os sys re json math time datetime typing collections itertools functools pathlib logging argparse subprocess threading multiprocessing asyncio abc enum dataclasses copy io random string uuid hashlib base64 tempfile shutil glob unittest warnings traceback contextlib inspect types operator decimal fractions statistics csv sqlite3 socket ssl http urllib email html xml zipfile gzip tarfile pickle struct platform signal select queue heapq bisect array weakref gc textwrap pprint secrets hmac configparser getpass ctypes concurrent importlib pkgutil unicodedata locale gettext codecs fnmatch stat errno atexit sched smtplib ftplib imaplib webbrowser wsgiref cgi cmd shlex curses tkinter __future__ builtins numbers cmath zlib bz2 lzma tomllib zoneinfo graphlib mimetypes ast dis token tokenize site sysconfig venv ensurepip pdb timeit cProfile profile trace code codeop runpy zipimport selectors mmap fcntl termios pwd grp resource syslog readline rlcompleter this antigravity typing_extensions'.split(' '));
const JS_EXT_TRY = ['.ts','.tsx','.js','.jsx','.mjs','.cjs','.vue','.svelte','.astro'];

function stripJsComments(t){ return t.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,''); }
function extractFile(f, text){
  const r = {imports:[], routes:[], models:[], env:[], entry:null, pkg:null, ns:null};
  const lang = f.lang, ext = f.ext;
  if (['JavaScript','TypeScript','Vue','Svelte','Astro'].includes(lang) || ext==='dart') {
    const t = stripJsComments(text); const seen = new Set();
    const add = s => { if(!seen.has(s)){ seen.add(s); r.imports.push(s); } };
    for (const m of t.matchAll(/(?:^|[^\w$.])import\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"\n]+)['"]/g)) add(m[1]);
    for (const m of t.matchAll(/\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]([^'"\n]+)['"]/g)) add(m[1]);
    for (const m of t.matchAll(/\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g)) add(m[1]);
    for (const m of t.matchAll(/\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g)) add(m[1]);
    for (const m of t.matchAll(/\bprocess\.env\.([A-Z][A-Z0-9_]{2,})/g)) r.env.push(m[1]);
    for (const m of t.matchAll(/\bimport\.meta\.env\.([A-Z][A-Z0-9_]{2,})/g)) r.env.push(m[1]);
    for (const m of t.matchAll(/\b(?:app|router|server|api|route|fastify|r|routes|v1|v2)\.(get|post|put|patch|delete|all|head|options)\s*\(\s*(['"`])([^'"`\n]+)\2/g)) if (/^[\/*]/.test(m[3])) r.routes.push({method:m[1].toUpperCase(),path:m[3]});
    for (const m of t.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*['"`]?([^'"`)\n]*)['"`]?\s*\)/g)) r.routes.push({method:m[1].toUpperCase(),path:'/'+m[2].replace(/^\//,''),nest:true});
    for (const m of t.matchAll(/@Entity\([^)]*\)\s*(?:export\s+)?class\s+(\w+)/g)) r.models.push({name:m[1],kind:'TypeORM entity'});
    for (const m of t.matchAll(/mongoose\.model(?:<[^>]*>)?\(\s*['"](\w+)/g)) r.models.push({name:m[1],kind:'Mongoose model'});
    for (const m of t.matchAll(/(?:sequelize|db)\.define\(\s*['"](\w+)/g)) r.models.push({name:m[1],kind:'Sequelize model'});
    for (const m of t.matchAll(/pgTable\(\s*['"](\w+)/g)) r.models.push({name:m[1],kind:'Drizzle table'});
    if (/\.listen\s*\(|createServer\s*\(|serve\s*\(\s*\{|new\s+Hono\(|Deno\.serve/.test(t) && /(express|fastify|koa|http|hono|createServer|app\.listen)/.test(t)) r.entry = 'server';
    else if (/^#!.*node|commander|yargs|process\.argv/m.test(t) && /(^|\/)(bin|cli)/i.test(f.path)) r.entry = 'cli';
  } else if (lang==='Python') {
    for (const m of text.matchAll(/^[ \t]*from\s+(\.*)([\w.]*)\s+import\s+([^\n#]+)/gm)) r.imports.push({dots:m[1].length,mod:m[2],names:m[3].replace(/[()\\]/g,'').split(',').map(s=>s.trim().split(/\s+as\s+/)[0]).filter(Boolean)});
    for (const m of text.matchAll(/^[ \t]*import\s+([\w.]+(?:\s+as\s+\w+)?(?:\s*,\s*[\w.]+(?:\s+as\s+\w+)?)*)/gm)) for (const part of m[1].split(',')) r.imports.push({dots:0,mod:part.trim().split(/\s+as\s+/)[0],names:[]});
    for (const m of text.matchAll(/(?:os\.environ(?:\.get)?\s*[\[(]\s*|os\.getenv\s*\(\s*|environ\.get\(\s*)['"]([A-Z][A-Z0-9_]{2,})/g)) r.env.push(m[1]);
    for (const m of text.matchAll(/@\w+(?:\.\w+)*\.(get|post|put|patch|delete|websocket)\s*\(\s*f?['"]([^'"]*)['"]/g)) r.routes.push({method:m[1].toUpperCase(),path:m[2]||'/'});
    for (const m of text.matchAll(/@\w+(?:\.\w+)*\.route\s*\(\s*['"]([^'"]*)['"](?:[^)]*methods\s*=\s*\[([^\]]*)\])?/g)) r.routes.push({method:(m[2]||'GET').replace(/['"\s]/g,'').toUpperCase()||'GET',path:m[1]});
    if (/(^|\/)urls\.py$/.test(f.path)) for (const m of text.matchAll(/\b(?:re_)?path\s*\(\s*r?['"]([^'"]*)['"]/g)) r.routes.push({method:'ANY',path:'/'+m[1]});
    for (const m of text.matchAll(/^class\s+(\w+)\((?:[\w.]*\.)?(Model|Base|DeclarativeBase|SQLModel|Document|AbstractUser|BaseModel)\b/gm)) if (m[2]!=='BaseModel') r.models.push({name:m[1],kind:m[2]==='Model'?'Django model':m[2]==='Document'?'Document':'ORM model'});
    if (/if\s+__name__\s*==\s*['"]__main__['"]/.test(text)) r.entry='cli';
    if (/(FastAPI|Flask|Quart|Sanic|Starlette)\s*\(/.test(text) && /=\s*(FastAPI|Flask|Quart|Sanic|Starlette)\s*\(/.test(text)) r.entry='server';
    if (/uvicorn\.run|app\.run\(/.test(text)) r.entry='server';
  } else if (lang==='Go') {
    for (const m of text.matchAll(/^import\s*\(([\s\S]*?)\)/gm)) for (const s of m[1].matchAll(/"([^"]+)"/g)) r.imports.push(s[1]);
    for (const m of text.matchAll(/^import\s+(?:\w+\s+)?"([^"]+)"/gm)) r.imports.push(m[1]);
    for (const m of text.matchAll(/os\.Getenv\(\s*"([A-Z][A-Z0-9_]{2,})"/g)) r.env.push(m[1]);
    for (const m of text.matchAll(/\.(GET|POST|PUT|PATCH|DELETE|Get|Post|Put|Patch|Delete|Handle|HandleFunc|Any)\s*\(\s*"([^"]+)"/g)) if (m[2][0]==='/') r.routes.push({method:m[1].toUpperCase().replace('HANDLEFUNC','ANY').replace('HANDLE','ANY'),path:m[2]});
    if (/^func\s+main\s*\(\s*\)/m.test(text)) r.entry = /ListenAndServe|\.Run\(|\.Listen\(|grpc\.NewServer/.test(text)?'server':'cli';
    r.pkg = (text.match(/^package\s+(\w+)/m)||[])[1];
  } else if (lang==='Rust') {
    for (const m of text.matchAll(/^\s*(?:pub(?:\([^)]*\))?\s+)?use\s+([\w:]+)/gm)) r.imports.push({use:m[1]});
    for (const m of text.matchAll(/^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+(\w+)\s*;/gm)) r.imports.push({mod:m[1]});
    for (const m of text.matchAll(/std::env::var\(\s*"([A-Z][A-Z0-9_]{2,})"/g)) r.env.push(m[1]);
    for (const m of text.matchAll(/#\[(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) r.routes.push({method:m[1].toUpperCase(),path:m[2]});
    for (const m of text.matchAll(/\.route\(\s*"([^"]+)"/g)) r.routes.push({method:'ANY',path:m[1]});
    if (/^\s*(async\s+)?fn\s+main\s*\(/m.test(text)) r.entry = /(HttpServer|axum::serve|Router::new|rocket::build)/.test(text)?'server':'cli';
  } else if (['Java','Kotlin','Scala'].includes(lang)) {
    for (const m of text.matchAll(/^\s*import\s+(?:static\s+)?([\w.]+?)(?:\.\*|\._)?\s*;?\s*$/gm)) r.imports.push(m[1]+(/\.(\*|_)\s*;?\s*$/.test(m[0])?'.*':''));
    r.pkg = (text.match(/^\s*package\s+([\w.]+)/m)||[])[1];
    for (const m of text.matchAll(/@(Get|Post|Put|Patch|Delete|Request)Mapping\s*(?:\(\s*(?:(?:value|path)\s*=\s*)?\{?\s*"([^"]*)")?/g)) r.routes.push({method:m[1]==='Request'?'ANY':m[1].toUpperCase(),path:'/'+(m[2]||'').replace(/^\//,'')});
    for (const m of text.matchAll(/@Entity\b[\s\S]{0,300}?class\s+(\w+)/g)) r.models.push({name:m[1],kind:'JPA entity'});
    for (const m of text.matchAll(/System\.getenv\(\s*"([A-Z][A-Z0-9_]{2,})"/g)) r.env.push(m[1]);
    if (/@SpringBootApplication/.test(text)) r.entry='server'; else if (/static\s+void\s+main\s*\(|fun\s+main\s*\(/.test(text)) r.entry='cli';
  } else if (lang==='Ruby') {
    for (const m of text.matchAll(/^\s*require_relative\s+['"]([^'"]+)['"]/gm)) r.imports.push({rel:m[1]});
    for (const m of text.matchAll(/^\s*require\s+['"]([^'"]+)['"]/gm)) r.imports.push({gem:m[1]});
    if (/(^|\/)routes\.rb$/.test(f.path)) { for (const m of text.matchAll(/^\s*(get|post|put|patch|delete)\s+['"]([^'"]+)['"]/gm)) r.routes.push({method:m[1].toUpperCase(),path:'/'+m[2].replace(/^\//,'')}); for (const m of text.matchAll(/^\s*resources?\s+:(\w+)/gm)) r.routes.push({method:'REST',path:'/'+m[1]}); }
    for (const m of text.matchAll(/^class\s+(\w+)\s*<\s*(?:ApplicationRecord|ActiveRecord::Base)/gm)) r.models.push({name:m[1],kind:'ActiveRecord model'});
    for (const m of text.matchAll(/ENV\[['"]([A-Z][A-Z0-9_]{2,})/g)) r.env.push(m[1]);
  } else if (lang==='PHP') {
    for (const m of text.matchAll(/^\s*use\s+([\w\\]+)(?:\s+as\s+\w+)?\s*;/gm)) r.imports.push(m[1]);
    r.pkg = (text.match(/^\s*namespace\s+([\w\\]+)/m)||[])[1];
    for (const m of text.matchAll(/Route::(get|post|put|patch|delete|any)\(\s*['"]([^'"]+)/g)) r.routes.push({method:m[1].toUpperCase(),path:'/'+m[2].replace(/^\//,'')});
    for (const m of text.matchAll(/env\(\s*['"]([A-Z][A-Z0-9_]{2,})/g)) r.env.push(m[1]);
  } else if (lang==='C#') {
    for (const m of text.matchAll(/^\s*using\s+(?:static\s+)?([\w.]+)\s*;/gm)) r.imports.push(m[1]);
    r.ns = (text.match(/^\s*namespace\s+([\w.]+)/m)||[])[1];
    for (const m of text.matchAll(/\[Http(Get|Post|Put|Patch|Delete)(?:\(\s*"([^"]*)")?/g)) r.routes.push({method:m[1].toUpperCase(),path:'/'+(m[2]||'').replace(/^\//,'')});
    if (/static\s+(async\s+)?(void|Task)\s+Main\s*\(|WebApplication\.CreateBuilder/.test(text)) r.entry='server';
  } else if (['C','C++','Objective-C'].includes(lang)) {
    for (const m of text.matchAll(/^\s*#\s*include\s+"([^"]+)"/gm)) r.imports.push(m[1]);
    if (/^\s*int\s+main\s*\(/m.test(text)) r.entry='cli';
  } else if (lang==='SQL') {
    for (const m of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?[`"\[]?([\w.]+)/gi)) r.models.push({name:m[1],kind:'SQL table'});
  } else if (lang==='Prisma') {
    for (const m of text.matchAll(/^model\s+(\w+)\s*\{/gm)) r.models.push({name:m[1],kind:'Prisma model'});
    const p = text.match(/provider\s*=\s*"(postgresql|mysql|sqlite|mongodb|sqlserver|cockroachdb)"/); if (p) r.dbProvider = p[1];
  }
  return r;
}

/* ---------------- component discovery ---------------- */
const CONTAINERS = new Set(['apps','packages','services','cmd','internal','pkg','crates','libs','modules','plugins','src','lib','app','projects','microservices','components-lib','workspaces']);
function buildComponents(srcFiles, manifestDirs){
  const total = srcFiles.length;
  const TARGET = 16;
  const mset = new Set(manifestDirs);
  const hasManifestBelow = path => manifestDirs.some(d => d !== path && (path===''||d.startsWith(path+'/')));
  function children(node){
    const depth = node.path ? node.path.split('/').length : 0;
    const groups = new Map(); const direct = [];
    for (const f of node.files) {
      const parts = f.path.split('/');
      if (parts.length-1 === depth) direct.push(f); else { const k=parts[depth]; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(f); }
    }
    return {groups, direct, depth};
  }
  function collapse(node){
    for(;;){
      if (node.path && mset.has(node.path) && node.files.length<14) return node;
      const {groups, direct} = children(node);
      if (direct.length===0 && groups.size===1) { const [k,fs]=[...groups][0]; node={path:(node.path?node.path+'/':'')+k, files:fs}; } else return node;
    }
  }
  function expand(node){
    const {groups, direct} = children(node);
    const out = []; let other = direct.slice();
    for (const [k, fs] of groups) {
      const p = (node.path?node.path+'/':'')+k;
      if (groups.size > 5 && fs.length < 3 && !mset.has(p) && !hasManifestBelow(p)) other = other.concat(fs);
      else out.push(collapse({path:p, files:fs}));
    }
    if (other.length) out.push({path:node.path, files:other, isRest:true});
    return out;
  }
  const canExpand = n => { if (n.isRest) return false; if (n.path && mset.has(n.path) && !hasManifestBelow(n.path) && n.files.length<14) return false; const {groups,direct}=children(n); if (groups.size+(direct.length?1:0)<2) return false; return (n.path?n.path.split('/').length:0) < 14; };
  const forced = n => canExpand(n) && (n.path===''||CONTAINERS.has(base(n.path))||hasManifestBelow(n.path));
  let comps = [collapse({path:'',files:srcFiles})];
  for (let guard=0; guard<500; guard++) {
    let pick = comps.find(forced);
    if (!pick && comps.length < TARGET) {
      pick = comps.filter(n=>canExpand(n) && n.files.length >= Math.max(6,total*0.12)).sort((a,b)=>b.files.length-a.files.length)[0];
    }
    if (!pick) break;
    const kids = expand(pick);
    if (kids.length<2 && !kids[0]?.isRest && kids[0] && kids[0].path===pick.path) break;
    comps = comps.filter(c=>c!==pick).concat(kids);
  }
  // merge extra small comps beyond cap
  const CAP = 60;
  if (comps.length > CAP) {
    comps.sort((a,b)=>b.files.length-a.files.length);
    const keep = comps.slice(0,CAP-1), rest = comps.slice(CAP-1);
    keep.push({path:'', files:rest.flatMap(c=>c.files), isRest:true, isMisc:true});
    comps = keep;
  }
  return comps;
}

const ROLE_TOKENS = {
 client:'web client frontend front ui components component pages views view www static public templates template mobile ios android desktop widgets screens layouts styles css site website landing dashboard admin renderer webapp'.split(' '),
 api:'api apis routes route router routers controllers controller handlers handler endpoints endpoint server http rest graphql grpc rpc gateway middleware resolvers bff backend'.split(' '),
 cli:'cli cmd bin commands command console'.split(' '),
 worker:'worker workers jobs job tasks task queue queues cron consumers consumer scheduler schedulers daemon'.split(' '),
 core:'core services service domain usecases engine logic business features feature'.split(' '),
 data:'models model db database stores repository repositories repo schema schemas orm entities entity dao prisma persistence storage sql data'.split(' '),
 shared:'utils util utilities common shared helpers helper types typings constants config configs support commons base sdk'.split(' '),
 infra:'infra infrastructure deploy deployment terraform k8s kubernetes docker helm ansible ci tooling'.split(' ')
};
const ROLE_ORDER = ['client','api','cli','worker','core','data','shared','infra'];
const ROLE_COL = {client:0,api:1,cli:1,worker:1,core:2,data:3,shared:3,infra:3};
const ROLE_LABEL = {client:'Frontend / UI',api:'API / transport',cli:'CLI / entry',worker:'Worker / jobs',core:'Core logic',data:'Data layer',shared:'Shared / utils',infra:'Infra / tooling'};
function guessRole(comp, tags, langMix){
  const segs = comp.path.toLowerCase().split('/').filter(Boolean).slice(-3);
  const scores = {}; 
  segs.forEach((seg,i)=>{ const w = i===segs.length-1?2:1; for (const tok of seg.split(/[^a-z0-9]+/)) if (tok) for (const r of ROLE_ORDER) if (ROLE_TOKENS[r].includes(tok)) scores[r]=(scores[r]||0)+w; });
  let best=null,bs=0; for (const r of ROLE_ORDER) if ((scores[r]||0)>bs){bs=scores[r];best=r;}
  if (best) return {role:best, guessed:false};
  const labels = new Set(tags.map(t=>t.label));
  const uiFrameworks = ['React','Vue','Svelte','Angular','Solid','Preact','Next.js','Nuxt','Astro','SvelteKit','Remix','Gatsby','React Native'];
  const tot = Object.values(langMix).reduce((a,b)=>a+b,0)||1;
  const frac = ks => ks.reduce((a,k)=>a+(langMix[k]||0),0)/tot;
  if (frac(['HTML','CSS','Vue','Svelte','Astro'])>0.6 || uiFrameworks.some(u=>labels.has(u))) return {role:'client', guessed:true};
  if (frac(['SQL','Prisma'])>0.6) return {role:'data', guessed:true};
  if (frac(['Terraform'])>0.6) return {role:'infra', guessed:true};
  if (frac(['Protobuf','GraphQL'])>0.6) return {role:'api', guessed:true};
  return {role:'core', guessed:true};
}

/* ---------------- fetch helpers ---------------- */
function parseRepoInput(s){
  s = s.trim().replace(/^https?:\/\/(www\.)?github\.com\//,'').replace(/\.git$/,'').replace(/\/+$/,'');
  let ref = null;
  const at = s.match(/^([^@]+)@(.+)$/); if (at) { s = at[1]; ref = at[2]; }
  const tree = s.match(/^([^\/]+)\/([^\/]+)\/tree\/(.+)$/); if (tree) return {owner:tree[1], repo:tree[2], ref:tree[3]};
  const m = s.match(/^([\w.\-]+)\/([\w.\-]+)/); if (!m) throw new Error('Enter a repo like owner/name or a github.com URL');
  return {owner:m[1], repo:m[2], ref};
}

async function analyzeRepo(input, opts = {}, onProgress = ()=>{}){
  const {owner, repo, ref} = parseRepoInput(input);
  const token = opts.token || null, budget = opts.budget || 500;
  const hdr = {Accept:'application/vnd.github+json'}; if (token) hdr.Authorization = 'Bearer '+token;
  async function ghJson(path){
    const r = await fetch('https://api.github.com'+path,{headers:hdr});
    if (r.status===404) throw new Error(token?'Repository or branch not found.':'Repository or branch not found (private repos need a token).');
    if (r.status===403 || r.status===429) { const reset=r.headers.get('x-ratelimit-reset'); throw new Error('GitHub API rate limit hit'+(reset?' — resets at '+new Date(reset*1000).toLocaleTimeString():'')+'. Add a personal access token (⚙) to continue.'); }
    if (!r.ok) throw new Error('GitHub API error '+r.status);
    return r.json();
  }
  onProgress({phase:'Fetching repository metadata…', pct:2});
  const meta = await ghJson(`/repos/${owner}/${repo}`);
  const branch = ref || meta.default_branch;
  onProgress({phase:`Reading file tree (${branch})…`, pct:6});
  const tree = await ghJson(`/repos/${owner}/${repo}/git/trees/${encodeURI(branch)}?recursive=1`);
  const blobs = tree.tree.filter(e=>e.type==='blob');
  async function getText(path){
    try {
      let r;
      if (token) r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`,{headers:{Accept:'application/vnd.github.raw',Authorization:'Bearer '+token}});
      else r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${encodeURI(branch)}/${encodeURI(path)}`);
      if (!r.ok) return null; return await r.text();
    } catch(e){ return null; }
  }
  async function pool(items, n, fn){ let i=0; await Promise.all(Array.from({length:n},async()=>{ while(i<items.length){ const k=i++; await fn(items[k],k); } })); }

  /* files */
  const files = blobs.map((b,i)=>{ const ext=extOf(b.path); const kind=classify(b.path); return {id:i, path:b.path, size:b.size||0, ext, kind, lang:LANG[ext]||null, comp:-1, imports:new Set(), importedBy:new Set(), externals:new Set(), routes:[], models:[], scanned:false}; });
  const byPath = new Map(files.map(f=>[f.path,f]));
  const stats = {totalFiles:files.length, truncated:!!tree.truncated, byKind:{}, totalBytes:0};
  for (const f of files) { stats.byKind[f.kind]=(stats.byKind[f.kind]||0)+1; stats.totalBytes+=f.size; }
  const srcFiles = files.filter(f=>f.kind==='source');

  /* manifests & infra files */
  const manifestFiles = files.filter(f=>(MANIFESTS.has(base(f.path))||/^requirements.*\.txt$/.test(base(f.path))||f.path.endsWith('.csproj')) && !['ignored','test','aux'].includes(f.kind));
  const composeFiles = files.filter(f=>/(^|\/)(docker-)?compose[\w.\-]*\.ya?ml$/.test(f.path) && f.kind!=='ignored').slice(0,4);
  const dockerFiles = files.filter(f=>/(^|\/)Dockerfile[\w.\-]*$/.test(f.path) && f.kind!=='ignored').slice(0,15);
  const wfFiles = files.filter(f=>/^\.github\/workflows\/[^\/]+\.ya?ml$/.test(f.path)).slice(0,20);
  const envFiles = files.filter(f=>/(^|\/)\.env\.(example|sample|template|dist|local\.example)$|(^|\/)env\.example$/.test(f.path)).slice(0,5);
  const miscNames = ['Procfile','Makefile','README.md','readme.md','README.rst','vercel.json','netlify.toml','fly.toml','render.yaml','railway.json','app.yaml','serverless.yml','serverless.yaml','skaffold.yaml','Jenkinsfile','.gitlab-ci.yml','cloudbuild.yaml','docker-bake.hcl','wrangler.toml','nx.json','turbo.json','pnpm-workspace.yaml','lerna.json'];
  const miscFiles = files.filter(f=>miscNames.includes(f.path) || (f.path.split('/').length===2 && miscNames.includes(base(f.path)) && /^(Procfile|Makefile)$/.test(base(f.path))));
  const infraFiles = files.filter(f=>/\.(tf|tfvars)$/.test(f.path)||/(^|\/)(k8s|kubernetes|helm|charts?|manifests|deploy|deployment|infra|terraform|ansible|\.circleci)\//.test(f.path)&&/\.(ya?ml|tf|json)$/.test(f.path)||/(^|\/)(Chart\.yaml|kustomization\.ya?ml|cdk\.json|template\.ya?ml|pulumi\.[\w]+\.ya?ml)$/.test(f.path));

  onProgress({phase:'Reading manifests, Docker & CI config…', pct:10});
  const cfgList = [...manifestFiles.slice(0,80), ...composeFiles, ...dockerFiles, ...wfFiles, ...envFiles, ...miscFiles.slice(0,20)];
  const cfgText = new Map();
  await pool(cfgList, 10, async f=>{ const t = await getText(f.path); if (t!==null) cfgText.set(f.path,t); });

  const manifests = []; const goMods = []; const workspacePkgs = new Map(); const cargoPkgs = new Map();
  for (const f of manifestFiles) { const t=cfgText.get(f.path); if(t==null) continue; const m=parseManifest(f.path,t); manifests.push(m); const d=dirOf(f.path);
    if (m.eco==='go' && m.name) goMods.push({dir:d,module:m.name});
    if (m.eco==='npm' && m.name) workspacePkgs.set(m.name,d);
    if (m.eco==='cargo' && m.name) cargoPkgs.set(m.name.replace(/-/g,'_'),d); }
  goMods.sort((a,b)=>b.module.length-a.module.length);
  const manifestDirSet = new Set(manifestFiles.filter(f=>COMPONENT_MANIFESTS.has(base(f.path))||f.path.endsWith('.csproj')).map(f=>dirOf(f.path)).filter(d=>d!==''));
  const srcDirs = new Set(srcFiles.map(f=>dirOf(f.path)));
  const manifestDirs = [...manifestDirSet].filter(d=>[...srcDirs].some(s=>s===d||s.startsWith(d+'/')));

  /* components */
  onProgress({phase:'Discovering components…', pct:14});
  let rawComps = srcFiles.length ? buildComponents(srcFiles, manifestDirs) : [];
  const comps = rawComps.map((c,i)=>{
    const label = c.isMisc ? '(misc)' : c.isRest ? (c.path? c.path+'/(files)' : '(root files)') : (c.path||'(root)');
    const comp = {id:i, path:c.path, label, isRest:!!c.isRest, files:c.files.map(f=>f.id), size:c.files.reduce((a,f)=>a+f.size,0), langs:{}, tags:[], entries:[], endpoints:0, models:0, role:'core', roleGuessed:true, fanIn:0, fanOut:0, services:[], pkg:null, cycle:false};
    for (const f of c.files) { f.comp=i; if(f.lang) comp.langs[f.lang]=(comp.langs[f.lang]||0)+1; }
    return comp;
  });
  const compOfFile = f => f.comp>=0 ? comps[f.comp] : null;

  /* choose files to scan */
  const scanExts = srcFiles.filter(f=>SCAN_EXT.has(f.ext) && f.size < 250000);
  let toScan;
  if (scanExts.length <= budget) toScan = scanExts;
  else { // round-robin by component, shallow & small first
    const per = comps.map(c=>c.files.map(id=>files[id]).filter(f=>SCAN_EXT.has(f.ext)&&f.size<250000).sort((a,b)=>a.path.split('/').length-b.path.split('/').length||a.size-b.size));
    toScan = []; for (let k=0; toScan.length<budget; k++) { let any=false; for (const l of per) if (k<l.length) { toScan.push(l[k]); any=true; if(toScan.length>=budget)break; } if(!any)break; }
  }
  // also scan routing / entry-ish files regardless
  const extra = srcFiles.filter(f=>!toScan.includes(f) && SCAN_EXT.has(f.ext) && f.size<250000 && (/(^|\/)(main|app|server|index|routes?|urls|wsgi|asgi|manage|program|startup)\.\w+$/.test(f.path) && f.path.split('/').length<=3)).slice(0,60);
  toScan = toScan.concat(extra);
  const raw = new Map(); let done = 0;
  await pool(toScan, 12, async f=>{
    const t = await getText(f.path); done++;
    if (done%10===0 || done===toScan.length) onProgress({phase:`Scanning source files (${done}/${toScan.length})…`, pct:16+Math.round(done/toScan.length*66)});
    if (t==null) return; f.scanned = true; f.loc = t.split('\n').length; raw.set(f.id, extractFile(f,t));
  });

  /* ---------- resolution ---------- */
  onProgress({phase:'Resolving dependencies between files…', pct:84});
  const pathSet = new Set(files.map(f=>f.path));
  const dirIndex = new Map(); for (const f of srcFiles) { const d=dirOf(f.path); if(!dirIndex.has(d)) dirIndex.set(d,[]); dirIndex.get(d).push(f); }
  const dirKeys = [...dirIndex.keys()];
  const pyIdx = new Map(), pyStrip = new Map(), pyTops = new Set();
  for (const f of files) if (f.ext==='py' && f.kind!=='ignored') {
    let m = f.path.replace(/\.py$/,'').split('/'); if (m[m.length-1]==='__init__') m.pop(); if(!m.length) continue;
    const key = m.join('.'); pyIdx.set(key, f); pyTops.add(m[0]);
    for (let k=1;k<Math.min(m.length,4);k++){ const s=m.slice(k).join('.'); if(s && !pyStrip.has(s)) pyStrip.set(s,f); pyTops.add(m[k]); }
  }
  const jvmIdx = new Map(), nsIdx = new Map();
  for (const f of files) {
    if (['Java','Kotlin','Scala'].includes(f.lang) && f.kind!=='ignored') { const m=f.path.match(/(?:^|\/)(?:java|kotlin|scala)\/(.+)\.\w+$/); if(m) jvmIdx.set(m[1].replace(/\//g,'.'), f); }
  }
  for (const [id,r] of raw) { const f=files[id];
    if (r.pkg && ['Java','Kotlin','Scala'].includes(f.lang)) jvmIdx.set(r.pkg+'.'+base(f.path).replace(/\.\w+$/,''), f);
    if (r.pkg && ['Java','Kotlin','Scala'].includes(f.lang)) { if(!nsIdx.has(r.pkg)) nsIdx.set(r.pkg,[]); nsIdx.get(r.pkg).push(f); }
    if (r.ns && f.lang==='C#') { if(!nsIdx.has(r.ns)) nsIdx.set(r.ns,[]); nsIdx.get(r.ns).push(f); }
    if (r.pkg && f.lang==='PHP') jvmIdx.set(r.pkg+'\\'+base(f.path).replace(/\.\w+$/,''), f);
  }
  const rep = dir => { let list = dirIndex.get(dir); if(!list||!list.length){ const k=dirKeys.find(d=>d.startsWith(dir+'/')); list=k!==undefined?dirIndex.get(k):[]; } if(!list.length) return null;
    return list.find(f=>/^(index|main|lib|mod|__init__|app)\./.test(base(f.path))) || list.slice().sort((a,b)=>b.size-a.size)[0]; };
  const tryJs = b => { if (pathSet.has(b) && SOURCE_EXT.has(extOf(b))) return byPath.get(b);
    const noExt = b.replace(/\.(js|jsx|mjs|cjs)$/,'');
    for (const e of JS_EXT_TRY) { if (pathSet.has(b+e)) return byPath.get(b+e); if (noExt!==b && pathSet.has(noExt+e)) return byPath.get(noExt+e); }
    for (const e of JS_EXT_TRY) if (pathSet.has(b+'/index'+e)) return byPath.get(b+'/index'+e);
    return null; };
  const pkgNameOf = s => s[0]==='@' ? s.split('/').slice(0,2).join('/') : s.split('/')[0];
  const nearestPkgDir = p => { let d=dirOf(p); while(true){ if(manifestDirSet.has(d)) return d; if(d==='')return ''; d=dirOf(d);} };

  function resolve(f, spec, r){
    const lang = f.lang; const L = {internal:[], ext:null};
    if (['JavaScript','TypeScript','Vue','Svelte','Astro'].includes(lang) || f.ext==='dart') {
      if (f.ext==='dart') { if (spec.startsWith('package:')) { L.ext=spec.slice(8).split('/')[0]; return L; } if(spec.startsWith('dart:')) return L; const t=tryJs(normPath(dirOf(f.path)+'/'+spec)); if(pathSet.has(normPath(dirOf(f.path)+'/'+spec))) L.internal.push(byPath.get(normPath(dirOf(f.path)+'/'+spec))); return L; }
      if (spec.startsWith('node:')) return L;
      if (spec[0]==='.') { const t = tryJs(normPath(dirOf(f.path)+'/'+spec)); if (t) L.internal.push(t); return L; }
      if (/^(@|~|#)\//.test(spec) || spec.startsWith('src/')) {
        const rest = spec.replace(/^(@|~|#)\//,''); const pd = nearestPkgDir(f.path);
        for (const pre of ['', 'src/', 'app/', pd?pd+'/src/':'', pd?pd+'/':'', pd?pd+'/app/':'']) { if (pre==='' && spec.startsWith('src/')) { const t=tryJs(rest); if(t){L.internal.push(t);return L;} continue; } const t = tryJs(pre+rest); if (t) { L.internal.push(t); return L; } }
        return L;
      }
      const pkg = pkgNameOf(spec);
      if (workspacePkgs.has(pkg)) { const d=workspacePkgs.get(pkg); const sub=spec.slice(pkg.length+1); let t = sub? (tryJs(d+'/'+sub)||tryJs(d+'/src/'+sub)):null; if(!t) t = rep(d+'/src')||rep(d); if (t) L.internal.push(t); return L; }
      if (NODE_BUILTIN.has(pkg)) return L;
      // baseUrl-style: 'components/Button'
      const first = spec.split('/')[0];
      if (spec.includes('/') && (dirIndex.has('src/'+first) || dirKeys.some(d=>d.startsWith('src/'+first+'/')))) { const t=tryJs('src/'+spec); if(t){L.internal.push(t);return L;} }
      L.ext = pkg; return L;
    }
    if (lang==='Python') {
      const {dots, mod, names} = spec;
      if (dots>0) { let d = dirOf(f.path); for (let k=1;k<dots;k++) d = dirOf(d); const baseDir = mod? normPath(d+'/'+mod.replace(/\./g,'/')) : d;
        const tp = p => pathSet.has(p+'.py')?byPath.get(p+'.py'):pathSet.has(p+'/__init__.py')?byPath.get(p+'/__init__.py'):null;
        let any=false; for (const n of names) { const t=tp(baseDir+'/'+n); if(t){L.internal.push(t);any=true;} } if(!any){ const t=tp(baseDir); if(t) L.internal.push(t); } return L; }
      const top = mod.split('.')[0];
      if (PY_STDLIB.has(top)) return L;
      const look = k => pyIdx.get(k)||pyStrip.get(k);
      let any=false; for (const n of names) { const t=look(mod+'.'+n); if(t){L.internal.push(t);any=true;} }
      if (!any) { const t=look(mod); if(t){L.internal.push(t);any=true;} else { const parts=mod.split('.'); for(let k=parts.length-1;k>0&&!any;k--){ const t2=look(parts.slice(0,k).join('.')); if(t2){L.internal.push(t2);any=true;} } } }
      if (!any && !pyTops.has(top)) L.ext = top;
      return L;
    }
    if (lang==='Go') {
      const gm = goMods.find(g=>spec===g.module||spec.startsWith(g.module+'/'));
      if (gm) { const rel = spec.slice(gm.module.length+1); const t = rep(normPath(gm.dir+'/'+rel)); if (t) L.internal.push(t); return L; }
      const first = spec.split('/')[0]; if (!first.includes('.')) return L;
      L.ext = spec; return L;
    }
    if (lang==='Rust') {
      if (spec.mod) { const d=dirOf(f.path), b=base(f.path).replace(/\.rs$/,''); const sib=['mod','main','lib'].includes(b)?d:d+'/'+b;
        for (const c of [sib+'/'+spec.mod+'.rs', sib+'/'+spec.mod+'/mod.rs']) if (pathSet.has(normPath(c))) { L.internal.push(byPath.get(normPath(c))); break; } return L; }
      const segs = spec.use.split('::'); const head=segs[0];
      if (['std','core','alloc','self','super'].includes(head)) return L;
      if (head==='crate') { const m=f.path.match(/^(.*?\/?src)\//); const root=m?m[1]:'src';
        for (let k=Math.min(segs.length,4);k>=2;k--) { const p=root+'/'+segs.slice(1,k).join('/'); for (const c of [p+'.rs',p+'/mod.rs']) if (pathSet.has(c)) { L.internal.push(byPath.get(c)); return L; } }
        return L; }
      if (cargoPkgs.has(head)) { const t=rep(cargoPkgs.get(head)+'/src'); if(t) L.internal.push(t); return L; }
      L.ext = head.replace(/_/g,'-'); return L;
    }
    if (['Java','Kotlin','Scala'].includes(lang)) {
      if (spec.startsWith('java.') || spec.startsWith('kotlin.') || spec.startsWith('scala.')) return L;
      let name = spec;
      if (name.endsWith('.*')) { const ns=name.slice(0,-2); const list=nsIdx.get(ns); if (list&&list[0]) { L.internal.push(list[0]); return L; } for (const [k,v] of jvmIdx) if (k.startsWith(ns+'.')) { L.internal.push(v); return L; } L.ext = ns.split('.').slice(0,3).join('.'); return L; }
      for (let k=0;k<3;k++) { const t=jvmIdx.get(name); if (t) { L.internal.push(t); return L; } const i=name.lastIndexOf('.'); if(i<0)break; name=name.slice(0,i); }
      L.ext = spec.split('.').slice(0,3).join('.'); return L;
    }
    if (lang==='C#') { if (spec.startsWith('System')) return L; const list=nsIdx.get(spec); if (list&&list[0]) { L.internal.push(list[0]); return L; } if (/^Microsoft\./.test(spec)) L.ext=spec.toLowerCase().split('.').slice(0,3).join('.'); else if(!spec.includes('.')||true) { const topNs=spec.split('.')[0]; if (![...nsIdx.keys()].some(k=>k.split('.')[0]===topNs)) L.ext=spec.toLowerCase().split('.').slice(0,2).join('.'); } return L; }
    if (lang==='PHP') { const t=jvmIdx.get(spec); if (t) { L.internal.push(t); return L; } const top=spec.split('\\')[0]; if (![...jvmIdx.keys()].some(k=>k.split('\\')[0]===top)) L.ext = top.toLowerCase()==='illuminate'? 'illuminate' : spec.split('\\').slice(0,2).join('\\').toLowerCase(); return L; }
    if (lang==='Ruby') { if (spec.rel!==undefined) { const t=normPath(dirOf(f.path)+'/'+spec.rel); for (const c of [t+'.rb',t]) if (pathSet.has(c)) { L.internal.push(byPath.get(c)); break; } } else if (spec.gem) { if (!['json','set','yaml','time','date','net/http','uri','fileutils','securerandom','digest','erb','logger','optparse','open3','tempfile','forwardable','singleton','ostruct','benchmark','bigdecimal','csv','zlib','stringio','pathname','socket','timeout','monitor','pp','English','rbconfig'].includes(spec.gem) && !spec.gem.startsWith('active')&&true) { const first=spec.gem.split('/')[0]; if(![...dirIndex.keys()].some(d=>d.split('/').includes(first))) L.ext = spec.gem.split('/')[0]; } } return L; }
    if (['C','C++','Objective-C'].includes(lang)) { const rel = normPath(dirOf(f.path)+'/'+spec); if (pathSet.has(rel)) L.internal.push(byPath.get(rel)); else { const hit = files.find(x=>x.path.endsWith('/'+spec)||x.path===spec); if (hit) L.internal.push(hit); } return L; }
    return L;
  }

  const fileEdges = []; const compEdges = new Map(); const extPkgs = new Map(); const envVars = new Map(); const routes = []; const models = []; const entries = [];
  let dbProviders = new Set();
  for (const [id, r] of raw) {
    const f = files[id]; const cf = compOfFile(f);
    for (const spec of r.imports) {
      const res = resolve(f, spec, r);
      for (const t of res.internal) {
        if (t===f) continue; f.imports.add(t.id); t.importedBy.add(f.id); fileEdges.push([f.id,t.id]);
        const ct = compOfFile(t);
        if (cf && ct && cf!==ct) { const k=cf.id+'>'+ct.id; let e=compEdges.get(k); if(!e){e={s:cf.id,t:ct.id,w:0,ex:[]};compEdges.set(k,e);} e.w++; if (e.ex.length<8) e.ex.push([f.path,t.path]); }
      }
      if (res.ext) { f.externals.add(res.ext); let x=extPkgs.get(res.ext); if(!x){x={name:res.ext,files:0,comps:new Map()};extPkgs.set(res.ext,x);} x.files++; if (cf) x.comps.set(cf.id,(x.comps.get(cf.id)||0)+1); }
    }
    for (const rt of r.routes) { if (rt.path.length>200) continue; f.routes.push(rt); routes.push({...rt, file:f.path, comp:f.comp}); if (cf) cf.endpoints++; }
    for (const m of r.models) { f.models.push(m); models.push({...m,file:f.path,comp:f.comp}); if(cf) cf.models++; }
    for (const v of r.env) { let e=envVars.get(v); if(!e){e={name:v,files:new Set(),example:null,sources:new Set()};envVars.set(v,e);} e.files.add(f.path); e.sources.add('code'); }
    if (r.dbProvider) dbProviders.add(r.dbProvider);
    if (r.entry && cf) entries.push({path:f.path, kind:r.entry, why:'code', comp:f.comp});
  }
  // filename-based entry points
  for (const f of srcFiles) {
    const b = base(f.path), depth = f.path.split('/').length;
    let kind = null;
    if (/^(manage|wsgi|asgi|__main__)\.py$/.test(b)) kind = b==='manage.py'?'cli':'server';
    else if (b==='main.go' && /(^|\/)cmd\//.test(f.path)) kind='cli';
    else if (/^(Program|Startup)\.cs$/.test(b)) kind='server';
    else if (/^(main|lib)\.rs$/.test(b) && b==='main.rs') kind='cli';
    else if (/^(server|main|app)\.(js|ts|mjs|cjs)$/.test(b) && depth<=3) kind='server';
    else if (/^index\.(js|ts|mjs|tsx|jsx)$/.test(b) && depth<=2) kind='app';
    else if (/(^|\/)bin\/[^\/]+$/.test(f.path) && depth<=3) kind='cli';
    else if (/(^|\/)(pages|app)\/(index|page|layout|_app)\.(tsx|jsx|js|ts|vue)$/.test(f.path)) kind='app';
    if (kind) entries.push({path:f.path, kind, why:'filename', comp:f.comp});
  }
  // next.js style file routes
  for (const f of files) {
    let m;
    if ((m = f.path.match(/(?:^|\/)(?:src\/)?pages\/api\/(.+)\.(?:ts|js|tsx|jsx)$/))) { routes.push({method:'ANY',path:'/api/'+m[1].replace(/\/index$/,'').replace(/\[(\w+)\]/g,':$1'),file:f.path,comp:f.comp,fileRoute:true}); if(f.comp>=0)comps[f.comp].endpoints++; }
    else if ((m = f.path.match(/(?:^|\/)(?:src\/)?app\/(.*?)\/?route\.(?:ts|js)$/))) { routes.push({method:'ANY',path:'/'+m[1].replace(/\[(\w+)\]/g,':$1'),file:f.path,comp:f.comp,fileRoute:true}); if(f.comp>=0)comps[f.comp].endpoints++; }
    else if ((m = f.path.match(/(?:^|\/)(?:src\/)?app\/(.*?)\/?page\.(?:tsx|jsx|ts|js)$/))) { routes.push({method:'PAGE',path:'/'+m[1].replace(/\(\w+\)\/?/g,'').replace(/\[(\w+)\]/g,':$1'),file:f.path,comp:f.comp,fileRoute:true}); }
    else if ((m = f.path.match(/(?:^|\/)(?:src\/)?pages\/(?!api\/)(.+)\.(?:tsx|jsx|vue|svelte)$/)) && !/_app|_document/.test(f.path)) routes.push({method:'PAGE',path:'/'+m[1].replace(/\/?index$/,'').replace(/\[(\w+)\]/g,':$1'),file:f.path,comp:f.comp,fileRoute:true});
  }
  const seenE = new Set(); const entriesU = entries.filter(e=>{ if(seenE.has(e.path))return false; seenE.add(e.path); return true; });

  /* ---------- config-derived ---------- */
  // env examples
  for (const f of envFiles) { const t=cfgText.get(f.path); if(!t) continue; for (const l of t.split('\n')) { const m=l.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]+)\s*=\s*(.*)$/); if(m){ let e=envVars.get(m[1]); if(!e){e={name:m[1],files:new Set(),example:null,sources:new Set()};envVars.set(m[1],e);} e.example=m[2].replace(/^["']|["']$/g,''); e.sources.add(f.path); } } }
  // compose
  const composeServices = []; const composeInfo = [];
  for (const f of composeFiles) {
    const y = parseYaml(cfgText.get(f.path)||''); const sv = y.services || (y.version?{}:{}); if (!sv || typeof sv!=='object') continue;
    composeInfo.push(f.path);
    for (const [name, s0] of Object.entries(sv)) { const s=s0||{};
      const toArr = v => v==null?[]:Array.isArray(v)?v:typeof v==='object'?Object.keys(v):[v];
      const envObj = {}; if (Array.isArray(s.environment)) s.environment.forEach(e=>{const [k,...v]=String(e).split('=');envObj[k]=v.join('=');}); else if (s.environment&&typeof s.environment==='object') Object.assign(envObj,s.environment);
      const buildCtx = typeof s.build==='string'?s.build:(s.build&&s.build.context)||null;
      composeServices.push({name, file:f.path, image:s.image||null, build:buildCtx, dockerfile:s.build&&s.build.dockerfile||null, ports:toArr(s.ports).map(String), env:envObj, dependsOn:toArr(s.depends_on), volumes:toArr(s.volumes).map(String), command:Array.isArray(s.command)?s.command.join(' '):s.command||null, profiles:toArr(s.profiles)});
    }
  }
  { const merged = new Map(); for (const s of composeServices) { const m = merged.get(s.name); if (!m) merged.set(s.name, s); else { for (const k of ['image','build','dockerfile','command']) if (s[k]) m[k]=s[k]; m.ports=[...new Set(m.ports.concat(s.ports))]; m.dependsOn=[...new Set(m.dependsOn.concat(s.dependsOn))]; m.volumes=[...new Set(m.volumes.concat(s.volumes))]; Object.assign(m.env,s.env); } } composeServices.length=0; composeServices.push(...merged.values()); }
  for (const s of composeServices) for (const [k,v] of Object.entries(s.env)) { let e=envVars.get(k); if(!e){e={name:k,files:new Set(),example:null,sources:new Set()};envVars.set(k,e);} e.sources.add('compose:'+s.name); if(e.example==null) e.example=v==null?null:String(v); }
  // dockerfiles
  const dockerInfo = dockerFiles.map(f=>{ const t=cfgText.get(f.path)||''; const stages=[...t.matchAll(/^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/gim)].map(m=>({image:m[1],name:m[2]||null}));
    return {path:f.path, stages, expose:[...t.matchAll(/^EXPOSE\s+(.+)$/gim)].flatMap(m=>m[1].split(/\s+/)), cmd:(t.match(/^(?:CMD|ENTRYPOINT)\s+(.+)$/im)||[])[1]||null, entrypoint:(t.match(/^ENTRYPOINT\s+(.+)$/im)||[])[1]||null}; });
  // workflows
  const workflows = wfFiles.map(f=>{ const y=parseYaml(cfgText.get(f.path)||''); let on=y.on; const triggers = on==null?[]:typeof on==='string'?[on]:Array.isArray(on)?on:Object.keys(on);
    const jobs = Object.entries(y.jobs||{}).map(([id,j])=>{ j=j||{}; const steps=Array.isArray(j.steps)?j.steps:[]; return {id, name:j.name||id, runsOn:Array.isArray(j['runs-on'])?j['runs-on'].join(','):(typeof j['runs-on']==='string'?j['runs-on']:''), needs:Array.isArray(j.needs)?j.needs:j.needs?[j.needs]:[], uses:steps.filter(s=>s&&s.uses).map(s=>String(s.uses).split('@')[0]), runs:steps.filter(s=>s&&s.run).map(s=>String(s.run).trim().split('\n')[0]).slice(0,6)}; });
    return {path:f.path, name:y.name||base(f.path), triggers, jobs}; });
  // scripts / makefile / procfile
  const scripts = {}; for (const m of manifests) if (m.extra && m.extra.scripts && Object.keys(m.extra.scripts).length) scripts[m.path] = m.extra.scripts;
  let makeTargets = []; const mk = cfgText.get('Makefile'); if (mk) makeTargets = [...mk.matchAll(/^([a-zA-Z][\w.\-]*):(?!=)/gm)].map(m=>m[1]).filter(t=>!t.startsWith('.')).slice(0,25);
  const procfile = cfgText.get('Procfile')||null;
  const deployTargets = [];
  const has = n => files.some(f=>f.path===n);
  if (has('vercel.json')) deployTargets.push('Vercel'); if (has('netlify.toml')) deployTargets.push('Netlify'); if (has('fly.toml')) deployTargets.push('Fly.io'); if (has('render.yaml')) deployTargets.push('Render');
  if (has('railway.json')) deployTargets.push('Railway'); if (has('Procfile')) deployTargets.push('Heroku-style Procfile'); if (has('app.yaml')) deployTargets.push('Google App Engine'); if (has('wrangler.toml')) deployTargets.push('Cloudflare Workers');
  if (has('serverless.yml')||has('serverless.yaml')) deployTargets.push('Serverless Framework'); if (infraFiles.some(f=>/\.tf$/.test(f.path))) deployTargets.push('Terraform'); if (infraFiles.some(f=>/(Chart\.yaml|k8s|kubernetes|helm)/i.test(f.path))) deployTargets.push('Kubernetes / Helm');
  if (has('.gitlab-ci.yml')) deployTargets.push('GitLab CI'); if (has('Jenkinsfile')) deployTargets.push('Jenkins'); if (files.some(f=>f.path.startsWith('.circleci/'))) deployTargets.push('CircleCI'); if (infraFiles.some(f=>/cdk\.json/.test(f.path))) deployTargets.push('AWS CDK');
  if (workflows.length) deployTargets.push('GitHub Actions'); if (dockerFiles.length||composeFiles.length) deployTargets.push('Docker');

  /* ---------- tech stack & services ---------- */
  const techStack = new Map(); // label -> {label,cat,sources:Set, comps:Set}
  const addTech = (t, source, compId) => { let e=techStack.get(t.label); if(!e){e={label:t.label,cat:t.cat,sources:new Set(),comps:new Set()};techStack.set(t.label,e);} e.sources.add(source); if(compId!=null&&compId>=0) e.comps.add(compId); };
  for (const m of manifests) { const d=dirOf(m.path); const owner = comps.filter(c=>d===''?false:(c.path===d||c.path.startsWith(d+'/'))).map(c=>c.id);
    for (const dep of m.deps.concat(m.devDeps)) { const t=techFor(dep); if (!t) continue; if (owner.length) owner.forEach(id=>addTech(t,'manifest',id)); else addTech(t,'manifest'); } }
  for (const x of extPkgs.values()) { const t=techFor(x.name); if(!t) continue; x.tech=t; for (const id of x.comps.keys()) addTech(t,'import',id); if(!x.comps.size) addTech(t,'import'); }
  for (const s of composeServices) if (s.image) { const hit=DOCKER_IMAGES.find(d=>d[0].test(s.image)); if(hit) { s.tech={label:hit[1],cat:hit[2]}; addTech({label:hit[1],cat:hit[2]},'compose'); } }
  for (const p of dbProviders) { const lbl={postgresql:'PostgreSQL',mysql:'MySQL',sqlite:'SQLite',mongodb:'MongoDB',sqlserver:'SQL Server',cockroachdb:'CockroachDB'}[p]; addTech({label:lbl,cat:'database'},'prisma'); }
  for (const e of envVars.values()) if (e.example) { const v=e.example; const hit = /postgres(ql)?(\+\w+)?:\/\//.test(v)?['PostgreSQL','database']:/mysql(\+\w+)?:\/\//.test(v)?['MySQL','database']:/mongodb(\+srv)?:\/\//.test(v)?['MongoDB','database']:/rediss?:\/\//.test(v)?['Redis','cache']:/amqps?:\/\//.test(v)?['RabbitMQ','queue']:null; if (hit) addTech({label:hit[0],cat:hit[1]},'env'); }
  // services = tech with service category
  const services = [];
  for (const t of techStack.values()) if (SERVICE_CATS.has(t.cat)) {
    const linked = new Map(); // comp -> weight
    for (const x of extPkgs.values()) if (x.tech && x.tech.label===t.label) for (const [cid,w] of x.comps) linked.set(cid,(linked.get(cid)||0)+w);
    for (const id of t.comps) if (!linked.has(id)) linked.set(id,1);
    services.push({id:'x:'+t.label, label:t.label, cat:t.cat, sources:[...t.sources], links:linked, inferred:false, pkgs:[...extPkgs.values()].filter(x=>x.tech&&x.tech.label===t.label).map(x=>x.name)});
  }

  /* ---------- tags per component ---------- */
  for (const c of comps) { c.stack=[]; for (const t of techStack.values()) if (t.comps.has(c.id) && !SERVICE_CATS.has(t.cat)) c.stack.push({label:t.label,cat:t.cat}); }
  for (const x of extPkgs.values()) if (x.tech && !SERVICE_CATS.has(x.tech.cat)) for (const cid of x.comps.keys()) { const c=comps[cid]; if(!c.tags.some(t=>t.label===x.tech.label)) c.tags.push({label:x.tech.label,cat:x.tech.cat}); }
  for (const c of comps) { c.scannedCount = c.files.filter(id=>files[id].scanned).length; if (!c.tags.length) c.tags = c.stack.filter(t=>['framework','frontend'].includes(t.cat)); }

  /* ---------- roles ---------- */
  for (const c of comps) {
    const g = guessRole(c, c.tags.concat(c.stack), c.langs); c.role=g.role; c.roleGuessed=g.guessed;
    const uiN = c.files.filter(id=>/^(tsx|jsx|vue|svelte|html|css|scss|astro)$/.test(files[id].ext)).length;
    if (['api','core','cli'].includes(c.role) && uiN/(c.files.length||1)>0.6 && c.stack.concat(c.tags).some(t=>['React','Vue','Svelte','Angular','Solid','Preact','Next.js','Nuxt','Astro','SvelteKit','Remix'].includes(t.label))) { c.role='client'; c.roleGuessed=true; }
    if (c.isMisc) { c.role='shared'; }
    const m = manifests.find(m=>dirOf(m.path)===c.path && COMPONENT_MANIFESTS.has(base(m.path))); if (m) c.pkg = {name:m.name, eco:m.eco, description:m.extra&&m.extra.description};
  }
  const edgeList = [...compEdges.values()];
  for (const e of edgeList) { comps[e.s].fanOut++; comps[e.t].fanIn++; }
  for (const c of comps) { const ents = entriesU.filter(e=>e.comp===c.id); c.entries = ents.map(e=>e.path); }
  for (const c of comps) if (c.roleGuessed && c.role==='core') {
    if (c.entries.length && c.fanIn===0) c.role = /server/.test(entriesU.find(e=>e.comp===c.id)?.kind||'')?'api':'cli';
    else if (c.fanIn>=3 && c.fanOut<=1) c.role='shared';
  }
  // cycles (Tarjan)
  { const adj = comps.map(()=>[]); edgeList.forEach(e=>adj[e.s].push(e.t)); let idx=0; const st=[],on=[],ix=[],low=[]; 
    const sc = v => { ix[v]=low[v]=idx++; st.push(v); on[v]=true; for (const w of adj[v]) { if (ix[w]===undefined){ sc(w); low[v]=Math.min(low[v],low[w]); } else if (on[w]) low[v]=Math.min(low[v],ix[w]); }
      if (low[v]===ix[v]) { const comp=[]; let w; do { w=st.pop(); on[w]=false; comp.push(w);} while(w!==v); if (comp.length>1) comp.forEach(i=>comps[i].cycle=true); } };
    comps.forEach((_,v)=>{ if (ix[v]===undefined) sc(v); }); }

  // infer service links for services with none
  const pref = {database:['data','core','api'],cache:['data','core','api'],queue:['worker','core','api'],search:['data','core','api'],storage:['core','api','data'],auth:['api','core'],cloud:['core','api','worker'],ai:['core','api'],payments:['core','api'],monitoring:['api','core'],email:['core','worker','api'],realtime:['api','client','core'],gateway:['api','client']};
  // compose build -> component (needed for inference)
  for (const s of composeServices) if (s.build) { const ctx = normPath(dirOf(s.file)+'/'+s.build); s.comps = ctx==='' ? comps.filter(c=>c.entries.length).map(c=>c.id) : comps.filter(c=>c.path===ctx||c.path.startsWith(ctx+'/')||ctx.startsWith(c.path+'/')).map(c=>c.id); } else s.comps=[];
  for (const s of services) if (s.links.size===0) {
    s.inferred = true;
    const cs = composeServices.find(x=>x.tech&&x.tech.label===s.label);
    if (cs) { const deps = composeServices.filter(x=>x.dependsOn.includes(cs.name)&&x.comps.length); const pool = (deps.length?deps:composeServices.filter(x=>x.comps.length)).flatMap(x=>x.comps); pool.slice(0,3).forEach(id=>s.links.set(id,0)); if (s.links.size) continue; }
    const order = pref[s.cat]||['core','api'];
    for (const r of order) { const cand = comps.filter(c=>c.role===r && !c.isMisc && c.scannedCount>=2).sort((a,b)=>b.files.length-a.files.length)[0]; if (cand) { s.links.set(cand.id,0); break; } }
    if (s.links.size===0 && comps[0]) s.links.set(comps.slice().sort((a,b)=>b.files.length-a.files.length)[0].id,0);
  }

  /* ---------- aggregates ---------- */
  const langAgg = {}; for (const f of srcFiles) if (f.lang) { const l=langAgg[f.lang]||(langAgg[f.lang]={name:f.lang,files:0,bytes:0}); l.files++; l.bytes+=f.size; }
  const languages = Object.values(langAgg).sort((a,b)=>b.bytes-a.bytes);
  const readmeText = cfgText.get('README.md')||cfgText.get('readme.md')||cfgText.get('README.rst')||'';
  let about = ''; { const paras = readmeText.replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,'').split(/\n\s*\n/).map(p=>p.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[#*_`>]/g,'').trim()).filter(p=>p.length>60&&!/^(\[|\|)/.test(p)); about=(paras[0]||'').slice(0,500); }
  const envList = [...envVars.values()].map(e=>({name:e.name,files:[...e.files],example:e.example,sources:[...e.sources]})).sort((a,b)=>a.name.localeCompare(b.name));
  routes.sort((a,b)=>a.path.localeCompare(b.path));
  const uniqRoutes=[]; { const seen=new Set(); for (const r of routes) { const k=r.method+' '+r.path+' '+r.file; if(!seen.has(k)){seen.add(k);uniqRoutes.push(r);} } }
  onProgress({phase:'Done', pct:100});
  return {
    repo:{owner,name:repo,branch,url:meta.html_url,description:meta.description,stars:meta.stargazers_count,language:meta.language,license:meta.license&&meta.license.spdx_id,topics:meta.topics||[],pushed:meta.pushed_at,size:meta.size,forks:meta.forks_count,homepage:meta.homepage},
    stats:{...stats, sourceFiles:srcFiles.length, scanned:raw.size, scanTargets:toScan.length, budget, languages, testFiles:stats.byKind.test||0},
    files:files.map(f=>({id:f.id,path:f.path,size:f.size,ext:f.ext,kind:f.kind,lang:f.lang,comp:f.comp,scanned:f.scanned,loc:f.loc||0,imports:[...f.imports],importedBy:[...f.importedBy],externals:[...f.externals],routes:f.routes,models:f.models})),
    comps, edges:edgeList, fileEdges, services:services.map(s=>({...s,links:[...s.links.entries()]})),
    entries:entriesU, routes:uniqRoutes, models, env:envList,
    compose:{files:composeInfo, services:composeServices}, docker:dockerInfo, workflows, scripts, makeTargets, procfile, deployTargets,
    infraFiles:infraFiles.map(f=>f.path).slice(0,60),
    manifests:manifests.map(m=>({path:m.path,eco:m.eco,name:m.name,deps:m.deps.length,devDeps:m.devDeps.length})),
    tech:[...techStack.values()].map(t=>({label:t.label,cat:t.cat,sources:[...t.sources],comps:[...t.comps]})),
    externalPkgs:[...extPkgs.values()].map(x=>({name:x.name,files:x.files,comps:x.comps.size,tech:x.tech?x.tech.label:null})).sort((a,b)=>b.files-a.files).slice(0,80),
    about
  };
}
//#ANALYZER-END
