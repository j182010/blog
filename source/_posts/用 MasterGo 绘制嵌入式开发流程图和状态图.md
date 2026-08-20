---
title: 用 MasterGo 绘制嵌入式开发流程图/状态图
date: 2024-05-03
tags: [UI, 工具]
categories: 技巧
---
官网：https://mastergo.com

MasterGo（莫高设计）是国产云端 UI/UX 设计 + 产设研协同平台，常被当作 Figma 国内替代；除了画界面，也很适合画**流程图、状态图、交互原型**等嵌入式开发配套插图。
相较于传统绘图工具，MasterGo 支持矢量绘制、组件复用、自动布局与研发标注，可高效完成充电桩、工控设备等嵌入式项目的状态机、UI 交互流程图绘制，支持团队在线协同评审，是 Figma 本土化替代优选。

### 绘制技巧
1. 将常用状态节点（正常/运行/故障）保存为组件，实现全局样式同步
2. 使用连线工具绘制状态跳转，节点移动时连线自动跟随
3. 开启研发模式，可直接导出标注信息给嵌入式 GUI 开发

<!-- ![充电桩UI流程图](/downloads/images/STD01_V1.1.webp) -->
*以下为实际项目中的充电桩 UI 状态流程图：*
<img src="/downloads/images/STD01_V1.1.webp" alt="充电桩UI流程图" style="max-width:100%; border-radius:6px;" />