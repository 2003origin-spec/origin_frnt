---
title: "Real Numbers: Short Notes"
type: short_notes
chapter: c10.mathematics.real-numbers
order: 2
---

## 1. Real numbers (Class 9 recap)

- **Rational** numbers can be written as $\dfrac{p}{q}$, where $p$ and $q$ are integers and $q \ne 0$. Examples: $5$, $-\dfrac34$, $0.25$.
- **Irrational** numbers cannot be written this way. Examples: $\sqrt2$, $\sqrt3$, $\sqrt{15}$, $\pi$, $0.10110111011110\ldots$
- Rational and irrational numbers together make up the **real numbers**.
- This chapter uses prime numbers to answer two questions: how numbers break into primes, and why numbers like $\sqrt2$ are irrational.

## 2. The Fundamental Theorem of Arithmetic

- A **prime** has exactly two factors: 1 and itself (2, 3, 5, 7, 11, ...). A **composite** number has more than two factors (4, 6, 8, 9, ...). The number 1 is neither.
- If you multiply two or more primes (repeats allowed), you get a composite number. There are **infinitely many** primes.
- To go the other way, break a number into primes with a **factor tree**.

:::remember
**Theorem 1.1 (Fundamental Theorem of Arithmetic):** Every composite number can be expressed (factorised) as a product of primes, and this factorisation is unique, apart from the order in which the prime factors occur.
:::

- "Unique" means there is **only one** list of primes (counting repeats). $2 \times 3 \times 5 \times 7$ and $3 \times 5 \times 7 \times 2$ count as the same factorisation.
- If we always write the primes in **ascending order** and join repeats into powers, the form is fixed. Example: $32760 = 2^3 \times 3^2 \times 5 \times 7 \times 13$.

:::example{title="Can 4ⁿ end with 0? (NCERT Example 1)"}
A number that ends with 0 is divisible by 10, so it has both 2 and 5 as prime factors.

$4^n = 2^{2n}$, so its only prime factor is 2. By uniqueness, 5 can never appear.

So **no** natural number $n$ makes $4^n$ end with 0.
:::

## 3. HCF and LCM by prime factorisation

Write each number as a product of powers of primes. Then:

| | Which primes? | Which power? |
|---|---|---|
| HCF | only the common ones | smallest |
| LCM | every prime that appears | greatest |

:::example{title="96 and 404 (NCERT Example 3)"}
$96 = 2^5 \times 3$ and $404 = 2^2 \times 101$.

Common prime: only 2. Smallest power: $2^2$. So HCF $= 4$.

LCM $= \dfrac{96 \times 404}{4} = 9696$.
:::

:::example{title="6, 72 and 120 (NCERT Example 4)"}
$6 = 2 \times 3$, $72 = 2^3 \times 3^2$, $120 = 2^3 \times 3 \times 5$.

HCF $= 2^1 \times 3^1 = 6$.

LCM $= 2^3 \times 3^2 \times 5 = 360$.
:::

## 4. HCF × LCM

- For **two** positive integers: $\text{HCF}(a, b) \times \text{LCM}(a, b) = a \times b$.
- Use it to get the LCM quickly once you have the HCF.
- For **three** numbers it is **not** true in general. For 6, 72 and 120: $6 \times 72 \times 120 = 51840$, but $\text{HCF} \times \text{LCM} = 6 \times 360 = 2160$.
- NCERT's "Note to the reader" gives two formulas that do work for three numbers $p, q, r$ (see the Formula Sheet).

## 5. Word problems: HCF or LCM?

| The question asks for... | Use |
|---|---|
| when things happen together again | LCM |
| the smallest number all of them divide | LCM |
| the largest equal size, length or group | HCF |
| the largest number that divides all of them | HCF |

:::example{title="Sonia and Ravi (NCERT Exercise 1.1)"}
One round takes Sonia 18 minutes and Ravi 12 minutes. They start together.

They meet again at the start after LCM(18, 12) $= 36$ minutes.
:::

## 6. A key result about primes

:::remember
**Theorem 1.2:** Let $p$ be a prime number. If $p$ divides $a^2$, then $p$ divides $a$, where $a$ is a positive integer.
:::

- Why: the primes of $a^2$ are just the primes of $a$, each used twice. So a prime that divides $a^2$ must already be one of the primes of $a$.
- NCERT marks this proof "not from the examination point of view". Know the statement and how to **use** it.
- It needs $p$ to be **prime**. For example, 4 divides $6^2 = 36$, but 4 does not divide 6.

## 7. Proving that √2 is irrational

The method is **proof by contradiction**: assume the opposite, and show it leads to something impossible.

1. Assume $\sqrt2$ is rational: $\sqrt2 = \dfrac{a}{b}$, where $a, b$ are integers, $b \ne 0$, and $a, b$ are **coprime** (cancel any common factor first).
2. Then $\sqrt2\, b = a$. Squaring, $2b^2 = a^2$. So 2 divides $a^2$, and by Theorem 1.2, 2 divides $a$.
3. Write $a = 2c$. Then $2b^2 = 4c^2$, so $b^2 = 2c^2$. So 2 divides $b^2$, and so 2 divides $b$.
4. Now 2 divides both $a$ and $b$. This **contradicts** "$a$ and $b$ are coprime".
5. So the assumption was wrong: $\sqrt2$ is **irrational**.

The same steps (with 3 in place of 2) prove $\sqrt3$ is irrational. They work for $\sqrt p$ for any prime $p$.

## 8. Sums and products with irrationals

From Class 9: if $r$ is rational and $x$ is irrational, then

- $r + x$ and $r - x$ are irrational;
- $r\,x$ and $\dfrac{r}{x}$ are irrational, when $r \ne 0$.

To **prove** one case, again assume the number is rational and get a contradiction.

:::example{title="5 − √3 is irrational (NCERT Example 6)"}
Assume $5 - \sqrt3 = \dfrac{a}{b}$, with $a, b$ coprime integers, $b \ne 0$.

Then $\sqrt3 = 5 - \dfrac{a}{b} = \dfrac{5b - a}{b}$.

The right side is rational, so $\sqrt3$ would be rational. That contradicts "$\sqrt3$ is irrational". So $5 - \sqrt3$ is irrational.
:::

:::example{title="3√2 is irrational (NCERT Example 7)"}
Assume $3\sqrt2 = \dfrac{a}{b}$. Then $\sqrt2 = \dfrac{a}{3b}$, which is rational. This contradicts "$\sqrt2$ is irrational". So $3\sqrt2$ is irrational.
:::
