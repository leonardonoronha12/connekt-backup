import React from 'react';
import { Helmet } from 'react-helmet';
import { Settings, FileText, ScrollText, Bell, Database, Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const ConfigItem = ({ icon: Icon, title, description, id }) => (
  <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
    <div className="flex items-center gap-4">
      <Icon className="w-6 h-6 text-gray-500" />
      <div>
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
    <Switch id={id} />
  </div>
);

const PageItem = ({ name, path, status }) => (
  <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
    <div>
      <h3 className="font-semibold text-gray-800">{name}</h3>
      <p className="text-sm text-gray-500 font-mono">{path}</p>
    </div>
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
      status === 'Online' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
    }`}>
      {status}
    </span>
  </div>
);

const LogItem = ({ level, message, timestamp }) => {
  const levelColors = {
    INFO: 'bg-blue-100 text-blue-800',
    WARN: 'bg-yellow-100 text-yellow-800',
    ERROR: 'bg-red-100 text-red-800',
  };
  return (
    <div className="flex items-start gap-4 p-3 font-mono text-sm border-b border-gray-200 last:border-b-0">
      <span className={`w-16 text-center px-2 py-0.5 rounded-md text-xs font-semibold ${levelColors[level]}`}>{level}</span>
      <span className="flex-1 text-gray-700">{message}</span>
      <span className="text-gray-400">{timestamp}</span>
    </div>
  );
};


const AdminPage = () => {
  return (
    <>
      <Helmet>
        <title>Admin - Painel do Desenvolvedor</title>
        <meta name="description" content="Painel de configurações para desenvolvedores." />
      </Helmet>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-800">Painel do Desenvolvedor</h1>
            <p className="text-gray-500">Central de controle do sistema.</p>
          </div>
        </header>

        <main className="container mx-auto px-6 py-8">
          <Tabs defaultValue="configs" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="configs">
                <Settings className="w-4 h-4 mr-2" />
                Configs
              </TabsTrigger>
              <TabsTrigger value="paginas">
                <FileText className="w-4 h-4 mr-2" />
                Páginas
              </TabsTrigger>
              <TabsTrigger value="logs">
                <ScrollText className="w-4 h-4 mr-2" />
                Logs
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="configs" className="mt-6">
              <div className="space-y-4">
                <ConfigItem icon={Bell} title="Notificações por Email" description="Habilita o envio de notificações para os usuários." id="email-notifications" />
                <ConfigItem icon={Database} title="Modo de Manutenção" description="Coloca a aplicação em modo de manutenção." id="maintenance-mode" />
                <ConfigItem icon={Shield} title="Autenticação de Dois Fatores" description="Exigir 2FA para todos os administradores." id="2fa-auth" />
              </div>
            </TabsContent>

            <TabsContent value="paginas" className="mt-6">
              <div className="space-y-4">
                <PageItem name="Inbox" path="/" status="Online" />
                <PageItem name="Banco de Questões" path="/banco-de-questoes" status="Em Desenvolvimento" />
                <PageItem name="Página de Login" path="/login" status="Online" />
              </div>
            </TabsContent>

            <TabsContent value="logs" className="mt-6">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <LogItem level="INFO" message="User 'admin' logged in successfully." timestamp="2025-10-16 10:30:00" />
                <LogItem level="WARN" message="API response time is high: 2.5s" timestamp="2025-10-16 10:31:15" />
                <LogItem level="ERROR" message="Failed to connect to database: Connection refused." timestamp="2025-10-16 10:32:05" />
                <LogItem level="INFO" message="Conversation 'uuid-1234' updated." timestamp="2025-10-16 10:33:40" />
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
};

export default AdminPage;