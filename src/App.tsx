import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { useHashRoute } from '@/hooks/useHashRoute';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ListPage } from '@/components/main/ListPage';
import { TaskDrawer } from '@/components/task/TaskDrawer';
import { ActivityPanel } from '@/components/activity/ActivityPanel';
import { ContainerDialog } from '@/components/dialogs/ContainerDialog';
import { SharingDialog } from '@/components/dialogs/SharingDialog';
import { StatusesDialog } from '@/components/dialogs/StatusesDialog';
import { ConfirmHost, Toaster } from '@/components/ui/overlays';

export default function App() {
  useEffect(() => {
    void useAppStore.getState().bootstrap();
  }, []);
  useHashRoute();

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-hidden" id="main">
          <ListPage />
        </main>
      </div>
      <TaskDrawer />
      <ActivityPanel />
      <ContainerDialog />
      <SharingDialog />
      <StatusesDialog />
      <ConfirmHost />
      <Toaster />
    </div>
  );
}
