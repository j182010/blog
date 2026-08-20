---
title: ITM
date: 2026-06-19 09:00:00
tags: [J-Link]
categories: 调试
---

<!-- toc -->

# ITM 与 SEGGER RTT Viewer 区别
> ITM：ARM Cortex‑M 内核自带的 **Instrumentation Trace Macrocell**，对应你前面看到的 `Trace Asynchronous Sw`（SWO 异步跟踪）。
> RTT：SEGGER J‑Link 私有技术，不依赖内核 Trace 外设，靠内存环形缓冲区交互。

## 硬件引脚
### ITM(SWO)
- 需要：`SWDIO`、`SWCLK` + **SWO 跟踪引脚**（单独一根物理引脚）
- STM32：PA13(SWDIO), PA14(SWCLK), **PB3=SWO**
- 必须硬件引出SWO引脚；很多最小系统板没有引出PB3，直接用不了ITM。
- 信号是**单向输出**：MCU → 调试器，MCU只能发，不能接收主机下发字符。

### RTT Viewer
- 只需要标准SWD两根线：`SWDIO + SWCLK`，**不需要SWO引脚**。
- 完全复用下载调试的SWD接口，不用额外接线。
- **双向通信**：MCU输出打印；PC端可以发字符串/命令给单片机。

## 工作原理
### ITM‑SWO
1. Cortex‑M内核ITM外设把printf字符打包成trace数据包
2. 通过SWO引脚串行输出
3. J‑Link/ST‑Link捕获SWO引脚电平，解析字节流输出日志
4. 属于**硬件跟踪外设**，内核硬件完成数据输出；CPU要开销驱动ITM寄存器。
> CubeMX里选项：`Trace Asynchronous Sw` 就是开启ITM‑SWO。

### RTT
1. MCU内存开辟**环形缓冲区（up‑buffer：MCU发PC；down‑buffer：PC发MCU）**
2. J‑Link调试器**不停通过SWD读MCU内存**，轮询读取缓冲区；写缓冲区实现PC下发数据。
3. **不使用内核Trace硬件，纯内存+调试器读写**。
4. 代码层面需要SEGGER_RTT库，把printf重定向到RTT。

## 关键性能对比
| 项目        | ITM‑SWO           | SEGGER RTT                  |
| --------- | ----------------- | --------------------------- |
| 额外引脚      | 需要SWO(PB3)        | 仅标准SWD，无需额外引脚               |
| 双向通信      | ❌只能MCU输出打印        | ✅双向收发，可下发命令                 |
| 中断里输出     | 高速中断慎用；波特率有限      | ✅支持中断输出（注意缓冲区溢出）            |
| 速度        | 受SWO波特率限制，一般几Mbit | 速度很高，不受外部引脚波特率限制；受SWD读写速度限制 |
| ST‑Link支持 | ✅ST‑Link支持SWO     | ❌**ST‑Link不支持RTT！只能J‑Link** |
| 低功耗场景     | SWO引脚持续输出，会影响休眠   | MCU休眠时调试器读内存会唤醒MCU，低功耗测试要注意 |
| 代码依赖      | 内核自带，几乎不用额外代码     | 必须导入SEGGER_RTT源文件           |
| 缓冲区溢出     | 丢数据，直接截断          | 缓冲区满会丢字符，可以配置阻塞模式           |

## 实际开发痛点
1. **ST‑Link用户：只能用ITM‑SWO，不能用RTT**，RTT是SEGGER私有，ST‑Link硬件不支持。
2. RTT最大优势：不需要SWO引脚；支持双向交互；但是**必须J‑Link仿真器**。
3. ITM‑SWO：很多板子PB3被LED占用，或者没有引出，硬件直接废掉ITM打印。
4. ITM在高波特率下，如果CPU进入Sleep，SWO输出会乱码；RTT如果MCU休眠，调试器读内存会唤醒芯片，测STOP待机电流会不准。

## CubeMX对应关系回顾
- `Serial Wire`：普通SWD下载调试，只下载+断点调试，**没有打印输出功能**。
- `Trace Asynchronous Sw`：SWD+开启ITM异步跟踪，开启SWO打印输出。

## 选型建议
1. 手上是 **J‑Link仿真器 → 优先RTT Viewer**，不用折腾SWO引脚，支持双向命令交互，工程最舒服。
2. 手上是 **ST‑Link**：只能 ITM‑SWO(SWO引脚必须引出)，或者普通串口printf。
3. 做低功耗休眠电流测试：两者都有副作用，建议改用硬件UART打印。

### 补充小提示
- ITM printf重定向：重定向`ITM_SendChar()`
- RTT：把`SEGGER_RTT_printf()`包装成printf，或者retarget重定向stdout。

如果你需要，我可以贴极简的ITM打印重定向代码，以及RTT最小工程示例。




