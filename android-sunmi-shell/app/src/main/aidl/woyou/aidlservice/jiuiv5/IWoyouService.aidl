package woyou.aidlservice.jiuiv5;

import woyou.aidlservice.jiuiv5.ICallback;

/**
 * Minimal subset of Sunmi IWoyouService used by Chapter99 staff shell.
 * Full interface is larger; these methods are enough for receipt text + paper feed/cut.
 */
interface IWoyouService {
    void printerInit(in ICallback callback);
    void printText(String text, in ICallback callback);
    void lineWrap(int n, in ICallback callback);
    void sendRAWData(in byte[] data, in ICallback callback);
}
