import { useState, type ReactNode } from "react";
import type { BrainCli, BrainState, BrainCommand, BrainResponse } from "@t3tools/contracts";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxSearchInput,
  ComboboxTrigger,
} from "../ui/combobox";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "../ui/dialog";
import { connectCloudCommand, connectCloudOutcome, connectCloudReady } from "./connectCloud";

export type SendBrainCommand = (
  command: BrainCommand,
  background?: boolean,
) => Promise<BrainResponse | null>;
export const cliName = (cli: BrainCli) =>
  cli === "claude" ? "Claude Code" : cli === "codex" ? "Codex" : "OpenCode";

/** Fork-only: a searchable Brain list with each Brain's icon, like the project picker. */
export function BrainSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
}: {
  label: string;
  value: string;
  options: readonly BrainSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** A small ghost trigger for inline use, such as next to the new-chat headline. */
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const filteredOptions = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;
  const selected = options.find((option) => option.value === value) ?? null;
  return (
    <Combobox
      items={options}
      filteredItems={filteredOptions}
      autoHighlight
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      value={selected}
      onOpenChange={(open) => {
        if (!open) {
          setQuery("");
        }
      }}
      onValueChange={(option) => {
        if (option && !option.disabled && option.value !== value) {
          onChange(option.value);
        }
      }}
    >
      <ComboboxTrigger
        render={
          <Button
            type="button"
            variant={compact ? "ghost" : "outline"}
            size={compact ? "xs" : "sm"}
            disabled={disabled}
            aria-label={label}
          />
        }
      >
        {selected?.icon}
        <span className="max-w-60 truncate">{selected?.label ?? label}</span>
        <ChevronDownIcon className="opacity-60" />
      </ComboboxTrigger>
      <ComboboxPopup align="start" className="w-64">
        <ComboboxSearchInput
          aria-label="Search Brains"
          placeholder="Search Brains"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ComboboxEmpty>No matching Brains.</ComboboxEmpty>
        <ComboboxList>
          {(option: BrainSelectOption) => (
            <ComboboxItem key={option.value} value={option} disabled={option.disabled}>
              {option.icon}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.value === value ? <CheckIcon className="ml-auto" /> : null}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}

export interface BrainSelectOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
}

export function CreateBrainDialog({
  open,
  onOpenChange,
  state,
  send,
  onCreated,
  initialName = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: BrainState | null;
  send: SendBrainCommand;
  onCreated: (id: string) => void;
  initialName?: string;
}) {
  const [location, setLocation] = useState<"local" | "remote">("local");
  const [endpoint, setEndpoint] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState(initialName);
  const [cli, setCli] = useState<BrainCli | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = cli ?? state?.clis.find((entry) => entry.installed)?.id;
  async function create() {
    if (
      busy ||
      (location === "local"
        ? !selected || !name.trim()
        : !connectCloudReady({ endpoint, email, password }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await send(
        location === "remote"
          ? connectCloudCommand({ endpoint, email, password, cli: selected })
          : { action: "create", name, cli: selected! },
      );
      const outcome = connectCloudOutcome(
        result,
        "Could not create the brain. Check the connection and retry.",
      );
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      setPassword("");
      onCreated(outcome.workspaceId);
      onOpenChange(false);
      setName(initialName);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          setPassword("");
          setError("");
          onOpenChange(next);
        }
      }}
    >
      <DialogPopup className="max-w-md">
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <DialogHeader>
            <DialogTitle>Create a brain</DialogTitle>
            <DialogDescription>
              Create a local Brain or connect to an existing remote Brain.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="space-y-5">
              <fieldset className="flex gap-4" disabled={busy}>
                <legend className="mb-2 text-sm">Brain location</legend>
                {(["local", "remote"] as const).map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="brain-location"
                      checked={location === value}
                      onChange={() => {
                        setLocation(value);
                        setError("");
                        setPassword("");
                      }}
                    />
                    {value === "local" ? "This computer" : "Remote Brain"}
                  </label>
                ))}
              </fieldset>
              {location === "remote" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Enter your remote Brain’s URL or invitation link, email, and password. Its
                    shared knowledge will be available to your projects.
                  </p>
                  <label className="block space-y-2 text-sm">
                    Brain URL or invitation link
                    <Input
                      required
                      type="url"
                      placeholder="https://brain.example.com"
                      value={endpoint}
                      disabled={busy}
                      onChange={(event) => setEndpoint(event.target.value)}
                    />
                  </label>
                  <label className="block space-y-2 text-sm">
                    Email
                    <Input
                      required
                      type="email"
                      autoComplete="username"
                      value={email}
                      disabled={busy}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <label className="block space-y-2 text-sm">
                    Password
                    <Input
                      required
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      disabled={busy}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                </>
              ) : (
                <label className="block space-y-2 text-sm">
                  Brain name
                  <Input
                    autoFocus
                    required
                    maxLength={80}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Acme platform"
                  />
                </label>
              )}
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm">
                  {location === "remote" ? "Write conversation notes with" : "Build knowledge with"}
                </legend>
                {state?.clis.map((entry) => (
                  <label
                    key={entry.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${!entry.installed ? "opacity-50" : selected === entry.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                  >
                    <input
                      type="radio"
                      name="brain-cli"
                      checked={selected === entry.id}
                      disabled={!entry.installed || busy}
                      onChange={() => setCli(entry.id)}
                    />
                    <span>
                      <span className="block font-medium">{cliName(entry.id)}</span>
                      <span className="text-xs text-muted-foreground">
                        {entry.installed
                          ? "Uses your existing CLI sign-in"
                          : "Not installed on this computer"}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPassword("");
                setError("");
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                busy ||
                (location === "local"
                  ? !name.trim() || !selected
                  : !connectCloudReady({ endpoint, email, password }))
              }
            >
              {location === "remote"
                ? busy
                  ? "Connecting cloud…"
                  : "Connect remote Brain"
                : busy
                  ? "Creating…"
                  : "Create brain"}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

export function ConnectCloudDialog({
  workspace,
  open,
  onOpenChange,
  send,
  onConnected,
}: {
  workspace?: { id: string; name: string; remote?: { endpoint: string } } | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  send: SendBrainCommand;
  onConnected: (id: string) => void;
}) {
  const [enteredEndpoint, setEndpoint] = useState("");
  const endpoint = enteredEndpoint || workspace?.remote?.endpoint || "";
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function connect() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await send(connectCloudCommand({ endpoint, email, password }, workspace?.id));
      const outcome = connectCloudOutcome(result, "Could not connect to the cloud Brain.");
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      setPassword("");
      onConnected(outcome.workspaceId);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          setPassword("");
          setError("");
          onOpenChange(next);
        }
      }}
    >
      <DialogPopup className="max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void connect();
          }}
        >
          <DialogHeader>
            <DialogTitle>Connect cloud Brain</DialogTitle>
            <DialogDescription>
              {workspace
                ? workspace.remote
                  ? `Sign in again to ${workspace.name} using your email and password.`
                  : `Move “${workspace.name}” to your team's Cloud Brain. All docs, skills and conversation notes transfer automatically. Missing repositories will be indexed in Cloud. Your local data is kept as a backup.`
                : "Connect to your team's Cloud Brain. Its shared knowledge will appear here."}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <label className="block space-y-2 text-sm">
              Brain URL or invitation link
              <Input
                required
                type="url"
                placeholder="https://brain.example.com"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
            </label>
            <label className="block space-y-2 text-sm">
              Email
              <Input
                required
                type="email"
                autoComplete="username"
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              New invitation? Choose a password of at least 12 characters. Already a member? Use
              your existing password. Ask your administrator for password resets.
            </p>
            <label className="block space-y-2 text-sm">
              Password
              <Input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPassword("");
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !connectCloudReady({ endpoint, email, password })}
            >
              {busy ? "Connecting cloud…" : "Connect Brain"}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
