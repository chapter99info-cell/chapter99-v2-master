package woyou.aidlservice.jiuiv5;

/**
 * Minimal Sunmi print-service callback (built-in thermal head).
 */
interface ICallback {
    oneway void onRunResult(boolean isSuccess);
    oneway void onReturnString(String result);
    oneway void onRaiseException(int code, String msg);
}
