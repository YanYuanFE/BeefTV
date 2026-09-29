import copy from "copy-to-clipboard";
import { toast } from "sonner";

export function useCopyText() {

    return (value: string, successText = "已复制") => {
        copy(value);
        toast.success(successText);
    };
}
