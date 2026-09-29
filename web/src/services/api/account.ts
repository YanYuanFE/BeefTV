import { http } from "@/services/api/request";

export const ACCOUNT_CHANNEL_ID = "account";
export const TWO_FACTOR_REASON = "two_factor_required";

export type AccountLoginPayload = {
    username: string;
    password: string;
    twoFactorCode?: string;
};

export type AccountSession = {
    baseUrl: string;
    apiKey: string;
    keyName: string;
    account: { id: string; username: string; displayName?: string; email?: string };
};

/** Signs in through the local backend, which targets the deployment's configured service. */
export function loginAccount(payload: AccountLoginPayload, signal?: AbortSignal) {
    return http.post<AccountSession>("/account/login", payload, { signal });
}
