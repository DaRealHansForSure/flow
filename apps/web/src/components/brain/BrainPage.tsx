import { BrainWorkspaceView, type BrainWorkspaceViewProps } from "@flow/brain-ui";
import { BrainCircuit } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { BrainSnapshot } from "../../brain/repository";
import { isElectron } from "../../env";
import { SidebarInset } from "../ui/sidebar";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { BrainGraphDialog, brainGraphCorner } from "./BrainGraphDialog";

export function BrainPage({
  snapshot,
  hasBrain,
  isIndexing,
  loading,
  connectionNotice,
  error,
  toolbar,
  indexing,
  indexingFailures,
  onRetryIndexing,
  indexingBusy,
  docs,
  skills,
  children,
  onCreate,
}: {
  snapshot: BrainSnapshot;
  hasBrain: boolean;
  isIndexing: boolean;
  loading: boolean;
  connectionNotice: { title: string; description: string } | null;
  error: string | null;
  toolbar: ReactNode;
  indexing: ReactNode;
  indexingFailures: NonNullable<BrainWorkspaceViewProps["indexingFailures"]>;
  onRetryIndexing: (sourceId: string) => void;
  indexingBusy: boolean;
  docs?: ReactNode;
  skills?: ReactNode;
  memories?: ReactNode;
  children: ReactNode;
  /** Absent where this computer cannot host a Brain, so none is offered. */
  onCreate?: () => void;
}) {
  const [graphExpanded, setGraphExpanded] = useState(false);
  const knowledge = { entities: snapshot.entities, edges: snapshot.edges };
  const hasKnowledge = knowledge.entities.length > 0;
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden">
      <WorkspacePageHeader electron={isElectron} className="border-b border-border/50">
        <BrainCircuit size={16} className="text-muted-foreground" />
        <span className="text-sm">Brain</span>
      </WorkspacePageHeader>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <BrainWorkspaceView
          snapshot={{
            id: snapshot.id,
            name: snapshot.name,
            sourceCount: snapshot.sources.length,
            entities: snapshot.entities,
            edges: snapshot.edges,
          }}
          hasBrain={hasBrain}
          isIndexing={isIndexing}
          loading={loading}
          connectionNotice={connectionNotice}
          error={error}
          toolbar={toolbar}
          indexing={indexing}
          indexingFailures={indexingFailures}
          onRetryIndexing={onRetryIndexing}
          indexingBusy={indexingBusy}
          sources={children}
          docs={docs}
          skills={skills}
          {...(onCreate ? { onCreate } : {})}
          graphCorner={hasKnowledge ? brainGraphCorner(() => setGraphExpanded(true)) : undefined}
        />
      </main>
      <BrainGraphDialog
        open={graphExpanded}
        onOpenChange={setGraphExpanded}
        title={snapshot.name}
        knowledge={knowledge}
      />
    </SidebarInset>
  );
}
