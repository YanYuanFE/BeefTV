import { applyFetchedChannelModelCatalog, configWithChannels } from "@/lib/channel-model-catalog";
import { fetchChannelModels } from "@/services/api/image";
import { ACCOUNT_CHANNEL_ID, loginAccount, type AccountLoginPayload, type AccountSession } from "@/services/api/account";
import { workspaceCapabilities } from "@/services/workspace-mode";
import { createModelChannel, useConfigStore, type AiConfig, type ModelChannel } from "@/stores/use-config-store";

const ACCOUNT_CHANNEL_NAME = "云端模型";
const ACCOUNT_LABEL_KEY = "beeftv-account-label";

// The account channel in the local model config is the login state:
// signed in means the channel exists and holds an issued API key.
export function accountChannel(config: AiConfig): ModelChannel | undefined {
    return config.channels.find((channel) => channel.id === ACCOUNT_CHANNEL_ID);
}

export function isSignedIn(config: AiConfig) {
    return Boolean(accountChannel(config)?.apiKey.trim());
}

/** Display name of the signed-in account; a UI convenience, empty when unavailable. */
export function readAccountLabel() {
    try {
        return localStorage.getItem(ACCOUNT_LABEL_KEY) || "";
    } catch {
        return "";
    }
}

function writeAccountLabel(label: string) {
    try {
        if (label) localStorage.setItem(ACCOUNT_LABEL_KEY, label);
        else localStorage.removeItem(ACCOUNT_LABEL_KEY);
    } catch {
        // Storage may be unavailable (private mode); the label is only cosmetic.
    }
}

/** Logs in and makes the account channel the only model channel. Models are pulled separately. */
export async function signIn(payload: AccountLoginPayload): Promise<AccountSession> {
    const session = await loginAccount(payload);
    const label = session.account.displayName || session.account.username;
    const current = useConfigStore.getState().config;
    const existing = accountChannel(current);
    const sameAccount = existing && existing.baseUrl === session.baseUrl && readAccountLabel() === label;
    const channel = createModelChannel({
        ...(sameAccount ? existing : {}),
        id: ACCOUNT_CHANNEL_ID,
        name: ACCOUNT_CHANNEL_NAME,
        baseUrl: session.baseUrl,
        apiKey: session.apiKey,
        apiFormat: "openai",
        interfaceType: undefined,
    });
    writeAccountLabel(label);
    useConfigStore.getState().replaceConfig(configWithChannels(current, [channel]));
    return session;
}

/** Pulls the account's model catalog into the channel; returns the model count. */
export async function refreshAccountModels(): Promise<number> {
    const channel = accountChannel(useConfigStore.getState().config);
    if (!channel?.apiKey.trim()) throw new Error("请先登录");
    const result = await fetchChannelModels(channel, !workspaceCapabilities().local);
    if (!result.models.length) throw new Error("当前账号没有可用模型");
    const latest = useConfigStore.getState().config;
    const latestChannel = accountChannel(latest);
    // The user signed out or switched accounts while the catalog was loading.
    if (latestChannel?.apiKey !== channel.apiKey) return 0;
    useConfigStore.getState().replaceConfig(configWithChannels(latest, latest.channels.map((item) => (item.id === ACCOUNT_CHANNEL_ID ? applyFetchedChannelModelCatalog(item, result) : item))));
    return result.models.length;
}

/** Clears the local key and models; the issued key itself stays on the service. */
export function signOut() {
    const current = useConfigStore.getState().config;
    writeAccountLabel("");
    // Keep an empty channel so the model config save path persists the sign-out.
    useConfigStore.getState().replaceConfig(configWithChannels(current, [createModelChannel({ id: ACCOUNT_CHANNEL_ID, name: ACCOUNT_CHANNEL_NAME, baseUrl: accountChannel(current)?.baseUrl, apiFormat: "openai" })]));
}
