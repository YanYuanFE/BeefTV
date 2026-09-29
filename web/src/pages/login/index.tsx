import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, ShieldCheck, User } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router";

import { BrandLogoFrame } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/services/api/request";
import { TWO_FACTOR_REASON } from "@/services/api/account";
import { isSignedIn, refreshAccountModels, signIn } from "@/services/account-session";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { useConfigStore } from "@/stores/use-config-store";
import { toast } from "sonner";
import { z } from "zod";

// twoFactorCode stays undefined until the field is shown after a two_factor_required error.
const loginSchema = z.object({
    username: z.string().refine((value) => value.trim().length > 0, "请输入账号"),
    password: z.string().min(1, "请输入密码"),
    twoFactorCode: z.string().refine((value) => value.trim().length > 0, "请输入验证码").optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

// Only same-site relative paths; strips control characters browsers ignore and
// rejects protocol-relative "//host" and "/\host" forms (open redirect).
export function safeRedirect(value: string | null): string {
    const cleaned = (value ?? "").replace(/[\t\n\r]/g, "");
    if (!cleaned.startsWith("/") || cleaned.startsWith("//") || cleaned.startsWith("/\\") || cleaned.startsWith("/login")) return "/";
    return cleaned;
}

export default function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), mode: "onChange", defaultValues: { username: "", password: "" } });
    const brandName = useAppearanceStore((state) => state.appearance.brandName);
    const signedIn = useConfigStore((state) => isSignedIn(state.config));
    const [busy, setBusy] = useState(false);
    const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
    const redirect = safeRedirect(searchParams.get("redirect"));

    if (signedIn && !busy) return <Navigate to={redirect} replace />;

    const submit = async (values: LoginValues) => {
        setBusy(true);
        try {
            await signIn({ username: values.username.trim(), password: values.password, twoFactorCode: values.twoFactorCode?.trim() || undefined });
        } catch (error) {
            setBusy(false);
            if (error instanceof ApiError && error.reason === TWO_FACTOR_REASON) {
                setNeedsTwoFactor(true);
                toast.warning(error.message);
                return;
            }
            toast.error(error instanceof Error ? error.message : "登录失败");
            return;
        }
        try {
            const count = await refreshAccountModels();
            toast.success(`登录成功，已拉取 ${count} 个模型`);
        } catch (error) {
            // Signed in already; the catalog can be pulled again from model settings.
            toast.warning(`登录成功，但拉取模型失败：${error instanceof Error ? error.message : "未知错误"}。可在模型配置中重试`);
        }
        navigate(redirect, { replace: true });
    };

    return (
        <main className="flex min-h-screen items-center justify-center overflow-y-auto bg-background px-4 py-10 text-foreground">
            <section className="w-full max-w-[400px]">
                <div className="mb-8 text-center">
                    <BrandLogoFrame className="mx-auto mb-4 grid size-12 place-items-center rounded-[var(--r-md)] shadow-sm" logoClassName="size-7 object-contain" alt="" fallback={<span aria-hidden>B</span>} />
                    <h1 className="text-2xl font-semibold">登录 {brandName}</h1>
                    <p className="mt-2 text-sm leading-6 text-foreground/55">登录账号后自动同步可用模型。</p>
                </div>
                <Form {...form}>
                    <form className="grid gap-6" noValidate onSubmit={form.handleSubmit((values) => void submit(values))}>
                        <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>账号</FormLabel>
                                    <PrefixedField icon={<User />}>
                                        <FormControl>
                                            <Input {...field} className="h-10 pl-9" autoComplete="username" autoFocus />
                                        </FormControl>
                                    </PrefixedField>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>密码</FormLabel>
                                    <PrefixedField icon={<Lock />}>
                                        <FormControl>
                                            <Input {...field} type="password" className="h-10 pl-9" autoComplete="current-password" />
                                        </FormControl>
                                    </PrefixedField>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {needsTwoFactor ? (
                            <FormField
                                control={form.control}
                                name="twoFactorCode"
                                defaultValue=""
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>双重验证码</FormLabel>
                                        <PrefixedField icon={<ShieldCheck />}>
                                            <FormControl>
                                                <Input {...field} className="h-10 pl-9" inputMode="numeric" autoComplete="one-time-code" autoFocus />
                                            </FormControl>
                                        </PrefixedField>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ) : null}
                        <Button type="submit" size="lg" className="h-10 w-full" loading={busy}>
                            登录
                        </Button>
                    </form>
                </Form>
            </section>
        </main>
    );
}

/** Input with a leading decorative icon. */
function PrefixedField({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="relative">
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground [&_svg]:size-4">
                {icon}
            </span>
            {children}
        </div>
    );
}
