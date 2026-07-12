package woyou.aidlservice.jiuiv5;

/**
 * Minimal Sunmi print-service callback (built-in thermal head).
 */
interface ICallback {
    oneWay void onRunResult(boolean isSuccess);
    oneWay void onReturnString(String result);
    oneWay void onRaiseException(int code, String msg);
}
