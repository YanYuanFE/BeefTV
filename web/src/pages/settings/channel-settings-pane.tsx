import { KeyRound, Pencil, RefreshCw, Workflow } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { ConfirmPopover } from "@/components/ui/confirm-popover";
import { Label } from "@/components/ui/label";
import { TagsInput } from "@/components/ui/tags-input";
import { ModelEditorModal } from "@/components/model-editor-modal";
import { WorkspaceState } from "@/components/layout/workspace-state";
import { configWithChannels } from "@/lib/channel-model-catalog";
import { ensureModelProfilesWithUiDefaults } from "@/lib/model-protocols";
import { ACCOUNT_CHANNEL_ID } from "@/services/api/account";
import { getModelConfigPersistenceState, subscribeModelConfigPersistence, type ModelConfigPersistenceState } from "@/services/model-config-repository";
import { accountChannel, isSignedIn, readAccountLabel, refreshAccountModels, signOut as signOutAccount } from "@/services/account-session";
import { channelHasGenerationCredential, useConfigStore, type ModelChannel } from "@/stores/use-config-store";
import { ChannelModelSettings } from "./channel-model-settings";
import { toast } from "sonner";

type ChannelSettingsPaneProps = {
    onOpenModels?: () => void;
    onOpenRunningHub?: () => void;
};

// Model channels come only from the signed-in account.
export function ChannelSettingsPane({ onOpenRunningHub }: ChannelSettingsPaneProps) {
    const navigate = useNavigate();
    const config = useConfigStore((state) => state.config);
    const replaceConfig = useConfigStore((state) => state.replaceConfig);
    const persistence = useSyncExternalStore(subscribeModelConfigPersistence, getModelConfigPersistenceState, getModelConfigPersistenceState);
    const [refreshing, setRefreshing] = useState(false);
    const [editing, setEditing] = useState(false);
    const channel = accountChannel(config);
    const signedIn = isSignedIn(config);
    const runningHubReady = Boolean(config.runningHub.enabled && config.runningHub.baseUrl.trim() && config.runningHub.apiKey.trim() && config.runningHub.workflowId.trim());

    const updateChannel = (patch: Partial<ModelChannel>) => {
        const latest = useConfigStore.getState().config;
        replaceConfig(configWithChannels(latest, latest.channels.map((item) => (item.id === ACCOUNT_CHANNEL_ID ? { ...item, ...patch } : item))));
    };

    const refreshModels = async () => {
        setRefreshing(true);
        try {
            const count = await refreshAccountModels();
            toast.success(`已拉取 ${count} 个模型`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "拉取模型失败");
        } finally {
            setRefreshing(false);
        }
    };

    const signOut = () => {
        signOutAccount();
        navigate("/login", { replace: true });
    };

    return (
        <div>
            <div className="settings-pane-header">
                <div className="min-w-0">
                    <h2>模型渠道</h2>
                </div>
            </div>
            {onOpenRunningHub ? (
                <section className="settings-section mb-3">
                    <div className="mb-3">
                        <h3 className="text-sm font-semibold">个人工作流渠道</h3>
                        <p className="mt-1 text-xs text-foreground/55">RunningHub 使用独立的云端工作流参数与执行通道。</p>
                    </div>
                    <div className="grid gap-2 lg:grid-cols-2">
                        <WorkflowChannelEntry
                            icon={<Workflow className="size-4" />}
                            title="RunningHub"
                            description="云端工作流和 RunningHub App"
                            status={runningHubReady ? `${config.runningHub.workflows.length} 个工作流已配置` : config.runningHub.enabled ? "待完成连接和工作流配置" : "未启用"}
                            ready={runningHubReady}
                            onOpen={onOpenRunningHub}
                        />
                    </div>
                </section>
            ) : null}
            {channel && signedIn ? (
                <section aria-labelledby="channel-account-title" className="settings-channel p-2.5 sm:p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                        <div className="flex min-w-0 flex-1 basis-52 items-start gap-2.5">
                            <span className="mt-0.5 shrink-0 text-[var(--workspace-accent)]" aria-hidden="true">
                                <KeyRound className="size-4" />
                            </span>
                            <div className="min-w-0">
                                <h3 id="channel-account-title" className="truncate text-sm font-semibold">
                                    云端模型
                                </h3>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground/55">
                                    {readAccountLabel() ? `${readAccountLabel()} · ` : ""}已保存 {channel.models.length} 个模型
                                    <ChannelStatus channel={channel} persistence={persistence} />
                                </div>
                            </div>
                        </div>
                        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto sm:shrink-0">
                            <Button variant="outline" className="h-10 sm:h-8" size="sm" loading={refreshing} onClick={() => void refreshModels()}>
                                {refreshing ? null : <RefreshCw className="size-3.5" />}
                                拉取模型
                            </Button>
                            <Button variant="outline" className="h-10 sm:h-8" size="sm" onClick={() => setEditing(true)}>
                                <Pencil className="size-3.5" />
                                模型与能力
                            </Button>
                            <ConfirmPopover title="退出登录？" description="将清除本机保存的访问密钥和模型列表，服务端的密钥不会被删除。" okText="退出" cancelText="取消" onConfirm={signOut}>
                                <Button variant="outline" className="h-10 sm:h-8" size="sm">
                                    退出登录
                                </Button>
                            </ConfirmPopover>
                        </div>
                    </div>
                    {editing ? (
                        <ModelEditorModal
                            open
                            title="模型与能力"
                            subtitle={channel.name}
                            onClose={() => setEditing(false)}
                            footer={
                                <div className="model-editor-footer">
                                    <span className="text-xs text-foreground/50">更改实时保存到本地工作区</span>
                                    <div className="model-editor-footer-actions">
                                        <Button variant="outline" loading={refreshing} onClick={() => void refreshModels()}>
                                            拉取模型
                                        </Button>
                                        <Button variant="outline" onClick={() => setEditing(false)}>完成</Button>
                                    </div>
                                </div>
                            }
                        >
                            <div className="model-editor-panel">
                                <section className="model-editor-section">
                                    <div>
                                        <h2>模型与能力</h2>
                                        <p className="mt-1 text-xs text-foreground/50">模型目录来自当前账号，可在单个模型中调整调用协议、能力和定价。</p>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor={`channel-${channel.id}-models`}>模型列表</Label>
                                        <TagsInput
                                            id={`channel-${channel.id}-models`}
                                            className="max-h-40 overflow-y-auto"
                                            tokenSeparators={[",", "\n"]}
                                            placeholder="点击拉取模型，或输入模型名"
                                            value={channel.models}
                                            onChange={(value) => {
                                                const models = uniqueModels(value);
                                                updateChannel({ models, modelProfiles: ensureModelProfilesWithUiDefaults(models, channel.modelProfiles, [], channel.apiFormat) });
                                            }}
                                        />
                                    </div>
                                    <ChannelModelSettings channel={channel} onChange={(modelProfiles) => updateChannel({ modelProfiles })} />
                                </section>
                            </div>
                        </ModelEditorModal>
                    ) : null}
                </section>
            ) : (
                <WorkspaceState icon="settings" compact title="尚未登录" action={<Button variant="outline" onClick={() => navigate("/login")}>去登录</Button>} />
            )}
        </div>
    );
}

function WorkflowChannelEntry({ icon, title, description, status, ready, onOpen }: { icon: ReactNode; title: string; description: string; status: string; ready: boolean; onOpen?: () => void }) {
    return (
        <div className="settings-channel flex min-w-0 items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-[var(--workspace-accent)]" aria-hidden="true">
                    {icon}
                </span>
                <div className="min-w-0">
                    <h4 className="text-sm font-semibold">{title}</h4>
                    <p className="mt-0.5 truncate text-xs text-foreground/55">{description}</p>
                    <span className={`settings-channel-status mt-1.5 ${ready ? "is-ready" : "is-warning"}`}>
                        <i aria-hidden="true" />
                        {status}
                    </span>
                </div>
            </div>
            <Button variant="outline" size="sm" onClick={onOpen} disabled={!onOpen}>
                配置
            </Button>
        </div>
    );
}

export function channelValidationError(channel: ModelChannel) {
    if (!channelHasGenerationCredential(channel)) return "请先登录";
    return !channel.models.length ? "请先拉取模型" : "";
}

export function isChannelReady(channel: ModelChannel) {
    return !channelValidationError(channel);
}

export function focusInvalidChannelField(channel: ModelChannel) {
    requestAnimationFrame(() => {
        document.getElementById(`channel-${channel.id}-title`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}

function ChannelStatus({ channel, persistence }: { channel: ModelChannel; persistence: ModelConfigPersistenceState }) {
    const error = channelValidationError(channel);
    return (
        <span className={`settings-channel-status ${error ? "is-warning" : "is-ready"}`}>
            <i aria-hidden="true" />
            {error || modelConfigChannelStatusLabel(channel, persistence)}
        </span>
    );
}

export function modelConfigChannelStatusLabel(channel: ModelChannel, persistence: ModelConfigPersistenceState) {
    if (!channelHasGenerationCredential(channel)) return "待登录";
    if (persistence.status === "saving") return "保存中";
    if (persistence.status === "error") return "保存失败";
    if (persistence.status === "saved") return "已保存";
    return "可用";
}

function uniqueModels(models: string[]) {
    return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}
