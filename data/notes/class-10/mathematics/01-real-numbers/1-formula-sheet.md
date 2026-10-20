---
title: "Real Numbers: Formula Sheet"
type: formula_sheet
chapter: c10.mathematics.real-numbers
order: 1
---

## Prime factorisation

:::formula{title="Fundamental Theorem of Arithmetic"}
$$x = p_1^{a_1}\, p_2^{a_2} \cdots p_k^{a_k}$$
$x$ = a composite number, $p_1 < p_2 < \dots < p_k$ = its different primes, $a_1, a_2, \dots$ = their powers (positive whole numbers).

Every composite number can be written like this, and **in only one way**, apart from the order of the primes.
:::

:::example{title="NCERT's factor-tree number"}
$32760 = 2^3 \times 3^2 \times 5 \times 7 \times 13$
:::

## HCF and LCM (prime factorisation method)

:::formula{title="HCF"}
$$\text{HCF} = \text{product of the smallest powers}$$
Take each prime that is **common** to all the numbers, with its **smallest** power.
:::

:::formula{title="LCM"}
$$\text{LCM} = \text{product of the greatest powers}$$
Take **every** prime that appears in any of the numbers, with its **greatest** power.
:::

:::example{title="6 and 20"}
$6 = 2 \times 3$ and $20 = 2^2 \times 5$.

HCF $= 2^1 = 2$. LCM $= 2^2 \times 3 \times 5 = 60$.
:::

:::formula{title="HCF × LCM for two numbers"}
$$\text{HCF}(a, b) \times \text{LCM}(a, b) = a \times b$$
$a, b$ = any two positive integers.

So, once you know the HCF:
$$\text{LCM}(a, b) = \frac{a \times b}{\text{HCF}(a, b)}$$
Only for **two** numbers. For three numbers it does not hold in general.
:::

:::formula{title="Coprime numbers"}
$$\text{LCM}(a, b) = a\,b$$
This holds when $\text{HCF}(a, b) = 1$. Then $a, b$ are **coprime**: they have no common factor other than 1.
:::

## Three numbers (NCERT "Note to the reader")

For three numbers, $\text{HCF} \times \text{LCM}$ is **not** equal to $p \times q \times r$ in general. These two results do hold.

Short names: $H_{pq} = \text{HCF}(p, q)$, $L_{pq} = \text{LCM}(p, q)$, and so on. $H_{pqr}$ and $L_{pqr}$ are the HCF and LCM of all three.

:::formula{title="LCM of three numbers"}
$$L_{pqr} = \frac{p\,q\,r \times H_{pqr}}{H_{pq}\,H_{qr}\,H_{pr}}$$
$p, q, r$ = positive integers.
:::

:::formula{title="HCF of three numbers"}
$$H_{pqr} = \frac{p\,q\,r \times L_{pqr}}{L_{pq}\,L_{qr}\,L_{pr}}$$
$p, q, r$ = positive integers.
:::

## Irrational numbers

:::formula{title="Rational number"}
$$s = \frac{p}{q}, \quad q \ne 0$$
$p, q$ = integers. A number that **cannot** be written like this is **irrational**.
:::

:::formula{title="Theorem 1.2"}
$$p \mid a^2 \Rightarrow p \mid a$$
$p$ = a **prime**, $a$ = a positive integer. "$p \mid a$" means "$p$ divides $a$".
:::

:::formula{title="Square root of a prime"}
$$\sqrt{p} \text{ is irrational}$$
$p$ = any prime. So $\sqrt2, \sqrt3, \sqrt5, \sqrt7, \dots$ are irrational.
:::

:::formula{title="Mixing rational and irrational"}
$r$ = rational, $x$ = irrational:
$$r + x \text{ and } r - x \text{ are irrational}$$
$$r\,x \text{ and } \frac{r}{x} \text{ are irrational if } r \ne 0$$
Example: $5 - \sqrt3$ and $3\sqrt2$ are irrational.
:::
