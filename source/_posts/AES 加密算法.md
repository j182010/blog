---
title: AES 加密算法
date: 2023-07-22
tags:
  - 算法
categories: 加密
---

<!-- toc -->

## <span class="color-title-inline">一、AES 是什么</span>
<!-- ## <span class="color-title-inline" style="--title-color: #E05656;">一、AES 是什么 指定颜色</span> -->

**AES（Advanced Encryption Standard）** 是目前应用最广泛的对称分组加密标准，由 NIST 于 2001 年发布，替代 DES。

- **分组长度**：固定 128 bit（16 字节）
- **密钥长度**：AES-128 / AES-192 / AES-256（16 / 24 / 32 字节）
- **对称加密**：加密和解密使用同一把密钥
- **轮数**：10 / 12 / 14 轮（对应 128 / 192 / 256 位密钥）

## <span class="color-title-inline">二、加密方式</span>

**加密方式分为五种：**

- 电码本模式（Electronic Codebook Book (ECB)）
- 密码分组链接模式（Cipher Block Chaining (CBC)）
- 计算器模式（Counter (CTR)）
- 密码反馈模式（Cipher FeedBack (CFB)）
- 输出反馈模式（Output FeedBack (OFB)）

**实际应用比较多的是ECB和CBC。**

## <span class="color-title-inline">三、ECB 模式（电子密码本）</span>

将明文按16字节分组，每组分别加密后拼接。

ECB 分组加密流程：

<img src="/downloads/doc/ECB.svg" style="width: 600px;"><br>

> ⚠️ ECB 致命缺陷：
>  - 相同明文块 → 相同密文块
>  - 明文结构直接反映到密文
>  - 加密图片可看出轮廓
>  - 无法抵抗重放 / 模式分析


## 四、CBC 模式（密码分组链接）

ECB缺点是明文内相同的明文块，最终的密文也是相同的，
为了更好的隐藏明文信息，针对这个问题就有了CBC模式。
每一小段明文先与初始块向量或者上一段的密文段进行异或运算后，再与密钥进行加密。
必须提供随机 IV，IV 不保密但不可重复。

