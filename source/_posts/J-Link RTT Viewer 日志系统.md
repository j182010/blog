---
title: J-Link RTT Viewer 日志系统
date: 2026-06-19 09:00:00
tags: [单片机]
categories: 技术文档
---

## 一、背景：串口日志的痛点

串口打印是嵌入式开发中最常见的调试手段，但在实际工程中越来越力不从心。

1. **实时性杀手**：在调试中断处理程序、电机控制、无线通讯等对时序极为敏感的场景时，UART `printf` 通过轮询或中断发送一个字节往往要耗时数微秒到数毫秒。轻则导致通信丢帧，重则系统直接崩溃。**RTT 的写入操作本质上只是一次内存拷贝，延迟在纳秒级，甚至可以在中断服务函数（ISR）中直接安全调用。**

2. **硬件资源占用**：UART 外设 + TX/RX 引脚，在多引脚复用的低成本 MCU 上是奢侈资源。以**燃气表、水表、烟感、BLE 信标**这类产品为例，量产阶段 UART 引脚通常不引出、不预留——传统串口日志在部署后等于"失明"，现场出问题时无从排查。

3. **单向为主，交互成本高**：传统串口即使做双向通信，也要额外处理回显、命令解析、中断抢占，且通常占用更多软件资源。而 RTT 天然支持全双工双向，相当于在调试口上"免费"开了一个交互式终端。

> 💡 **一句话总结**：串口日志在低成本、高实时、引脚紧张的场景下，要么用不起，要么不敢用。RTT 正是为解决这个问题而生——**复用调试口，零额外硬件，双向高速通信**。

---

## 二、J-Link RTT Viewer 是什么

**RTT（Real Time Transfer，实时传输）** 是 SEGGER 专为 J-Link 仿真器开发的**基于内存共享的高速双向实时通信机制**；它把 SWO 高速输出和半主机双向交互的优点以极高的性能结合起来。

**J-Link RTT Viewer** 是 SEGGER 配套提供的 GUI 上位机工具，属于 J-Link 软件安装包自带程序（Windows / macOS / Linux 均支持）。

<!-- 缩小图片尺寸 -->
<img src="/images/J-Link%20RTT%20Viewer%20日志系统/J-Link%20RTT%20Viewer%20日志系统-4.png" width="600">

<!--
居中显示图片
<img src="/images/J-Link%20RTT%20Viewer%20日志系统/J-Link%20RTT%20Viewer%20日志系统-4.png" width="600" style="display:block; margin:0 auto;">
-->

---

## 三、核心原理：为什么它"不占 MCU 资源"

### 3.1 整体架构

MCU 工程移植 SEGGER RTT 源码后，会在芯片 RAM 中创建 **RTT 控制块（RTT Control Block）** 与若干 **环形缓冲区（Ring Buffer）**：

1. 设备固件将日志、数据写入**上行缓冲区（Up-channel，Target → PC）**；
2. J-Link 通过已有的 SWD/JTAG 调试接口，**后台直接读取** MCU 内存中的缓冲区数据，全程**目标 CPU 不被 halt**；
3. PC 端工具（RTT Viewer / RTT Client / Telnet 客户端）接收数据并展示；
4. 同时支持反向写入**下行缓冲区（Down-channel，PC → Target）**，实现指令下发、双向交互。
![](/images/J-Link%20RTT%20Viewer%20日志系统/J-Link%20RTT%20Viewer%20日志系统-5.png)

### 3.2 无锁设计：读写指针的分工

这是 RTT 能在中断中安全调用的**核心秘密**——环形缓冲区的读写指针由不同角色独占修改：

| 缓冲区                 | 写指针由谁修改              | 读指针由谁修改                 |
| ------------------- | -------------------- | ----------------------- |
| **上行缓冲区**（MCU → PC） | **仅 MCU 端**写入        | **仅 J-Link（Host）**读取后更新 |
| **下行缓冲区**（PC → MCU） | **仅 J-Link（Host）**写入 | **仅 MCU 端**读取后更新        |

双方各写各的指针，永远不冲突，**无需任何锁、无需关中断、无需临界区保护**。这就是为什么 RTT 可以在 ISR 中直接调用的根本原因。

### 3.3 J-Link 如何定位控制块

J-Link 上电后会在目标 RAM 的已知范围内**自动扫描**带有特定标识符（`"SEGGER RTT"`）的控制块结构。一旦找到，后续通信就直接按地址读写环形缓冲区，不再需要 CPU 参与数据传输。这就是为什么 RTT Viewer 连接时通常只需选对芯片型号、勾选 Auto Detection 即可。

> 如果自动扫描失败（常见于 RAM 布局特殊或优化级别过高），可通过 map 文件定位 `_SEGGER_RTT` 符号地址，在 RTT Viewer 的 Address 栏手动填写。

### 3.4 阻塞 vs 非阻塞模式

每个通道可独立配置写入策略：

- **阻塞模式**（`SEGGER_RTT_MODE_BLOCK_IF_FIFO_FULL`）：缓冲区满时应用等待，直到 J-Link 读走数据腾出空间——保证日志不丢，但可能阻塞当前任务
- **非阻塞模式**（`SEGGER_RTT_MODE_NO_BLOCK_SKIP`）：缓冲区满时直接丢弃新数据，程序继续执行——**即使调试器没连，也不影响系统实时性**，代码可原样保留到 Release 版本

> ⚠️ 严谨说法：RTT 不是"零开销"，目标侧仍需把数据 memcpy 到 RAM 缓冲区；但它的巧妙之处在于**数据传输由 J-Link 通过调试接口后台异步完成**，不占用 UART 外设、不产生阻塞等待、不抢占 ISR。

---

## 四、相较 UART 串口打印的优势

| 维度 | RTT | UART 串口 |
|---|---|---|
| **额外硬件** | 无，复用调试接口 | 需要 UART 收发器 + USB-TTL 转接板 |
| **占用引脚** | 0（复用 SWD） | 至少 TX/RX 2 个引脚 |
| **通信方向** | 全双工双向 | 硬件全双工，但日志场景多为 TX-only |
| **传输速度** | 极高，可达 **1 MB/s 以上** | 受波特率限制，通常 ≤ 1 Mbps |
| **CPU 开销** | 极低（仅内存拷贝） | 较高（字节处理 + 中断） |
| **实时性影响** | 几乎无影响 | 轮询发送会阻塞；中断发送占用 ISR 时间 |
| **多路输出** | 原生支持多通道 + 多虚拟终端 | 需要多个 UART 外设 |
| **ISR 安全性** | ✅ 可在中断中直接调用 | ❌ 中断中调用易引发重入问题 |
| **量产保留** | 可保留代码，无硬件成本 | 引脚未引出即失效 |

---

## 五、工程移植（Keil）

### 5.1 获取源码

官方仓库：[https://github.com/SEGGERMicro/RTT](https://github.com/SEGGERMicro/RTT)

### 5.2 加入工程

将 GitHub 下载的软件包加入工程，需要关注的文件结构：

```
RTT/
├── SEGGER_RTT.c              ← 核心引擎（必加）
├── SEGGER_RTT.h              ← 调用接口
├── SEGGER_RTT_ASM_ARMv7M.S   ← ARMv7M/ARMv8M 汇编优化（可选）
├── SEGGER_RTT_Printf.c       ← 简化版 printf 实现（不支持 %f 浮点数）
└── Syscalls/
    └── SEGGER_RTT_Syscalls_*.c  ← 各工具链 printf 重定向
Config/
└── SEGGER_RTT_Conf.h         ← 配置文件（建议复制到工程配置目录）
```

![](/images/J-Link%20RTT%20Viewer%20日志系统/J-Link%20RTT%20Viewer%20日志系统-6.png)

### 5.3 初始化与打印

```c
#include "SEGGER_RTT.h"

int main(void) {
    // ... HAL_Init()、SystemClock_Config() 之后
    SEGGER_RTT_Init();
    SEGGER_RTT_printf(0, "hello..\r\n");   // 通道 0 = 默认终端
    while (1) {
        // ...
    }
}
```

⚠️ `SEGGER_RTT_printf` 是简化实现，**不支持 `%f` 浮点格式**。如果只需裸文本日志，它够用且体积小、速度快。

✅ **需要打印浮点数时，推荐用 §5.4 的 `fputc` 重映射方案**——重映射后标准 `printf` 走的是编译器 C 库，**原生支持 `%f / %e / %g`**，示例见下。ISR 内为保实时性，仍建议用 `SEGGER_RTT_Write` 写原始数据，浮点格式化放到主循环做。

```c
// 方案 A：重映射后，标准 printf 直接支持 %f（推荐用于应用层代码）
float temperature = 36.6f;
double voltage   = 3.1415926;
printf("temp=%.2f C, v=%.4f V\r\n", temperature, voltage);

// 方案 B：不想引入完整 printf，可先用 sprintf 格式化到栈缓冲，再交给 RTT 输出
char buf[64];
sprintf(buf, "temp=%.2f\r\n", temperature);
SEGGER_RTT_WriteString(0, buf);
```

### 5.4 串口重映射（printf 重定向）

为了让标准 `printf` 直接走 RTT，需要做半主机禁用 + `fputc` 重映射。

> **重映射后的 `printf` 支持 `%f` 浮点数打印**
> 
> 这里要特别注意一个常见误区：很多人以为"RTT 不支持浮点打印"，其实**要看用哪个接口**：
> 
> - `SEGGER_RTT_printf()` 是 SEGGER 自带的**简化版实现**，**不支持 `%f`**，遇到浮点格式会原样输出格式串或乱码；
>     
> - 而通过本节 `fputc` 重映射走的是**编译器标准库里的 `printf`**（无论是 MicroLIB 还是标准 C 库），**完整支持所有格式符，包括 `%f`、`%e`、`%g` 浮点数打印**。
>     
> 
> 换句话说，**只要做了 `fputc` 重定向，业务代码里直接写 `printf("temp=%.2f\r\n", 36.6);` 就能正常输出浮点**——代价是标准 `printf` 的代码体积比 `SEGGER_RTT_printf` 大一些，实时性要求极高的 ISR 内仍建议用 `SEGGER_RTT_Write` 写原始数据。

> **为什么要禁用半主机（Semihosting）？**
> 
> Keil 不使用 MicroLIB 时，标准 `printf` 默认走**半主机模式**——通过调试器陷入（breakpoint trap）让 CPU 暂停，由调试器代为处理 I/O。这会**直接 halt 目标 MCU**，在实时系统中是灾难性的。必须禁用半主机，并重新实现 `fputc` 将其重定向到 RTT。

```c
#ifdef __MICROLIB
    // 使用 MicroLIB 时，printf 直接通过 fputc 输出，无需额外处理
#else
    // 不使用 MicroLIB 时，必须禁用半主机模式
    #if defined (__CC_ARM) // Arm Compiler 5
        #pragma import(__use_no_semihosting)
        struct __FILE { int handle; };
        FILE __stdout;
        void _sys_exit(int x) { x = x; }

    #elif defined (__ARMCC_VERSION) && (__ARMCC_VERSION >= 6010050) // Arm Compiler 6
        __asm(".global __use_no_semihosting\n\t");
        FILE __stdout;
        void _sys_exit(int x) { x = x; }
    #endif
#endif

// 无论 MicroLIB 还是标准库，最终都会调用这个 fputc
int fputc(int ch, FILE *f)
{
    SEGGER_RTT_PutChar(0, (char)ch);  // 通道 0 = 默认终端
    return ch;
}
```

> 📌 AC6 用 `__asm` 内嵌全局符号 `.global __use_no_semihosting` 来禁用半主机，否则链接时会报 `_write`、`_read` 等符号未定义。

---

## 六、进阶：导入 uLog 组件，实现带颜色、等级的日志

单纯 `SEGGER_RTT_printf` 只能打裸文本。引入 **uLog**（RT-Thread 的微型日志组件，μ = 微）可以实现：

- ✅ **5 级日志**：`ASSERT / ERROR / WARNING / INFO / DEBUG`
- ✅ **ANSI 颜色输出**：不同级别自动上色（红/黄/绿/青），RTT Viewer 原生解释
- ✅ **标签 + 时间戳**：每行列明来源模块和时间
- ✅ **运行时过滤**：可按级别、标签、关键字动态过滤
- ✅ **异步输出**：专门线程负责刷日志，主业务零阻塞

### 6.1 配置（`rtconfig.h` 示例）

```c
/* Utilities */
#define RT_USING_ULOG
#define ULOG_OUTPUT_LVL_D
#define ULOG_OUTPUT_LVL        7
#define ULOG_ASSERT_ENABLE
#define ULOG_LINE_BUF_SIZE     128

/* log format */
#define ULOG_USING_COLOR           // 颜色
#define ULOG_OUTPUT_TIME           // 时间
#define ULOG_OUTPUT_LEVEL          // 级别
#define ULOG_OUTPUT_TAG            // 标签
/* end of log format */

#define ULOG_BACKEND_USING_CONSOLE // 控制台后端
#define ULOG_USING_FILTER          // 运行时过滤
/* end of Utilities */
```

### 6.2 使用方式

> 📌 以下示例基于 RT-Thread 环境，裸机工程需自行实现类似的宏封装。

```c
#define DBG_TAG  "main"
#define DBG_LVL  DBG_LOG
#include <rtdbg.h>

int main(void) {
    LOG_D("ulog debug is ok");
    LOG_I("system init done, tick=%u", rt_tick_get());
    LOG_W("sensor timeout, retry...");
    LOG_E("fatal: nvram crc mismatch");
    return 0;
}
```

uLog 内部用 `CSI_START` / `CSI_END` 包裹 ANSI 颜色码（如 `\033[31m` 红色、`\033[32m` 绿色），RTT Viewer 直接渲染成彩色行，日志可读性质实现飞跃。

*图：uLog 输出的彩色分级日志，RTT Viewer 原生渲染 ANSI 颜色码。*

![](/images/J-Link%20RTT%20Viewer%20日志系统/J-Link%20RTT%20Viewer%20日志系统-7.png)

---

## 七、RTT Server + Xshell：远程日志交互

### 7.1 原理

J-Link 软件在本地启动一个 **Telnet 服务**（默认 `127.0.0.1:19021`），任何第三方 Telnet 客户端都能接入读取 RTT 数据。该通道是"类 Telnet"的——纯可打印字符完全兼容，原始字节按裸字节解释。

> **触发条件**：只要 **J-Link 处于激活工作状态**，该 Telnet 服务就会自动启动——例如 Keil/IAR 进入调试模式，或 J-Link RTT Viewer 已成功连接目标芯片。

*图：RTT Telnet 服务架构示意。*

![](/images/J-Link%20RTT%20Viewer%20日志系统/J-Link%20RTT%20Viewer%20日志系统-2.png)

### 7.2 Xshell 配置

新建会话 → 协议选 **TELNET** → 主机 `127.0.0.1` → 端口 `19021` → 建议勾选"连接异常关闭时自动重新连接"。

### 7.3 日志记录

Xshell 左侧菜单"日志记录" → 设置保存文件路径与时间戳格式 → 重新连接即可把全部 RTT 输出落盘，方便事后追溯。

> 💡 这个方案对**燃气表、烟感等现场调试**特别实用：设备只留 SWD 口，笔记本接 J-Link + Xshell，既能实时看彩色日志，又能存档，还能键盘下发测试命令，一套顶 UART 的三套活。

> ⚠️ **多客户端互斥**：RTT Telnet 通道同一时刻只能被一个客户端占用。如果 RTT Viewer 已经连着，Xshell 可能连不上；反之亦然。需要断开一个再连另一个。
>
> ⚠️ **ANSI 转义码清洗**：Xshell 的日志记录会把所有 ANSI 颜色码也写入文件。后续用文本工具分析时，可先清洗：`sed -r 's/\x1B\[[0-9;]*m//g' log.txt > clean.txt`

*图：Xshell 连接 RTT Telnet 通道后的日志输出效果。*

![](/images/J-Link%20RTT%20Viewer%20日志系统/J-Link%20RTT%20Viewer%20日志系统-1.png)

---

## 八、工程落地注意事项（踩坑总结）

1. **初始化顺序**：`SEGGER_RTT_Init()` 必须在 `HAL_Init()`、`SystemClock_Config()` 之后、任何 RTT 调用之前。极端做法是用 `__attribute__((constructor))` 让它在 `main()` 之前自动执行。

2. **控制块找不到时**：通过 map 文件定位 `_SEGGER_RTT` 符号地址，在 RTT Viewer 的 Address 栏手动填写；或者检查是否被链接器优化掉了（可在 `SEGGER_RTT_Conf.h` 中确认缓冲区不被优化）。

3. **ISR 里慎用 `printf`**：格式化函数内部可能有等待逻辑；正确做法是 ISR 里只调用 `SEGGER_RTT_Write` 写入原始数据，主循环里统一格式化输出。

4. **缓冲区大小按场景调**：高频日志把 `BUFFER_SIZE_UP` 设 2048~4096；低功耗小 RAM 设备可降到 256；多任务日志启用多缓冲区分级。

5. **非阻塞模式会丢数据**：高频循环写入时 1KB 默认缓冲很快填满，要心中有数——非阻塞模式下丢数据是无声的，不会报错。

6. **AC6 编译**：必须用 `__asm(".global __use_no_semihosting\n\t")` 禁用半主机，否则链接失败。

7. **多虚拟终端**：通道 0 可在 RTT Viewer 里虚拟成 Terminal 0~15 多标签页，用 `SEGGER_RTT_SetTerminal(n)` 切换，实现 stdout / stderr / debug 分流；不同 Terminal 可用 ANSI 颜色码区分。

8. **目标必须在运行态**：RTT Viewer 连接前 MCU 不能处于 halt/断点状态，否则会显示空白或报错。勾选 **Force Go on Connect** 可让 J-Link 连上后自动恢复运行。

---

## 九、快速 Checklist

读者照着做时最容易忘的步骤，部署前逐项核对：

```
☐ J-Link 驱动已安装（≥ V6.30，RTT 需要较新版本）
☐ SEGGER_RTT.c 和 SEGGER_RTT_Conf.h 已加入工程
☐ 头文件路径已添加（RTT/ 和 Config/ 两个目录）
☐ SEGGER_RTT_Init() 在 main 早期调用
☐ Keil 未使用 MicroLIB 时，已禁用半主机 + 重定义 fputc
☐ RTT Viewer 连接时目标 MCU 在运行态（非断点 halt）
☐ 缓冲区大小按日志频率调整（默认 1KB 可能不够）
☐ 非阻塞模式下确认可接受的丢数据场景
☐ 需要浮点打印时改用 sprintf + SEGGER_RTT_Write
☐ Xshell 连不上时确认没有其他客户端占用 19021 端口
```

---

## 十、适用场景总结

RTT 特别适合：

- 🔋 **低成本设备**（燃气表、水表、烟感）：引脚紧张，不预留 UART，SWD 口是唯一调试通道
- 🚀 **高频日志**：传感器数据流、性能剖析、事件追踪，1 MB/s 吞吐轻松应对
- 💬 **交互式调试**：需要键盘输入下发命令（替代串口 shell）
- 🔒 **量产现场**：SWD 口保留即可，无需额外硬件，日志代码可常驻
- 📊 **多路分流**：日志、追踪、命令走不同通道互不干扰
- ⚡ **实时性敏感**：中断处理、电机控制、无线通信中安全调用，不阻塞业务

> 只要能用 J-Link 下载程序，就能用 RTT 输出调试信息——这是它对小型开发板最友好的地方。从原型验证到量产部署，一条调试链打通到底。

---

### 📎 参考资料

- SEGGER 官方 RTT 页面：[https://www.segger.com/products/debug-probes/j-link/technology/about-real-time-transfer/](https://www.segger.com/products/debug-probes/j-link/technology/about-real-time-transfer/)
- SEGGER RTT Wiki：[https://kb.segger.com/RTT](https://kb.segger.com/RTT)
- RTT TELNET 通道说明：[https://kb.segger.com/J-Link_RTT_TELNET_Channel](https://kb.segger.com/J-Link_RTT_TELNET_Channel)
- GitHub 源码：[https://github.com/SEGGERMicro/RTT](https://github.com/SEGGERMicro/RTT)
- uLog 组件文档：[https://rt-thread.github.io/rt-thread/page_component_ulog.html](https://rt-thread.github.io/rt-thread/page_component_ulog.html)
