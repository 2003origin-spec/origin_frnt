---
title: "Real Numbers: Important Points and Traps"
type: key_points
chapter: c10.mathematics.real-numbers
order: 3
---

## What is in the current book

:::remember
The current NCERT chapter has two main parts:
- the **Fundamental Theorem of Arithmetic** (prime factorisation, HCF and LCM);
- **irrational numbers** (Theorem 1.2 and proofs that $\sqrt2$, $\sqrt3$, ... are irrational).
:::

:::trap
The chapter's introduction still mentions **Euclid's division algorithm** and the **decimal expansion** of $\dfrac{p}{q}$. Those sections are **not** in the current book. Do not spend revision time on them for this chapter.
:::

## Primes and factorisation

- **1 is neither prime nor composite.** It never appears in a prime factorisation.
- **2 is the only even prime.**
- "Unique" factorisation means only one **set** of primes (with their powers). Changing the order does not give a new factorisation.
- Always check that the last factors are really prime. NCERT's example: $123456789 = 3^2 \times 3803 \times 3607$, where 3803 and 3607 are both primes.

:::trap
A number ends with **0** only if it has **both** 2 and 5 as prime factors.
- $4^n = 2^{2n}$ and $6^n = 2^n \times 3^n$ have no 5, so they never end with 0.
- $5^n$ has no 2, so it never ends with 0 either (it always ends with 5).
:::

:::tip
**Spotting a composite number.** Take out a common factor.
- $7 \times 11 \times 13 + 13 = 13\,(7 \times 11 + 1) = 13 \times 78$
- $7 \times 6 \times 5 \times 4 \times 3 \times 2 \times 1 + 5 = 5 \times 1009$

Each has a factor other than 1 and itself, so each is composite.
:::

## HCF and LCM

:::remember
- HCF: **common** primes, **smallest** powers.
- LCM: **all** primes, **greatest** powers.
- The HCF always divides the LCM.
- HCF $\le$ each number $\le$ LCM.
:::

:::trap
$\text{HCF} \times \text{LCM} = $ product of the numbers is a rule **only for two numbers**. For three numbers it does not hold in general.

For 6, 72 and 120: product $= 51840$, but $\text{HCF} \times \text{LCM} = 6 \times 360 = 2160$.
:::

:::trap
Do not mix up the rules. A prime that is in only **one** of the numbers goes into the LCM, but **not** into the HCF.

For $6 = 2 \times 3$ and $20 = 2^2 \times 5$: the 3 and the 5 go only into the LCM.
:::

- If the HCF is 1, the numbers are **coprime**, and their LCM is just their product. Example: $\text{LCM}(8, 9) = 72$.
- Two different primes are always coprime. So the LCM of 17, 23 and 29 is $17 \times 23 \times 29 = 11339$, and the HCF is 1.

:::trap
In "find the other number" questions, the HCF must divide the LCM. If the given HCF does not divide the given LCM, no such numbers exist.
:::

:::tip
**Word problems:** "together again", "at the same time", "smallest number divisible by" → **LCM**.
"Largest size", "greatest number of rows", "biggest equal pieces" → **HCF**.
:::

## Irrational numbers

:::remember
- Theorem 1.2: if a **prime** $p$ divides $a^2$, then $p$ divides $a$.
- $\sqrt p$ is irrational for every prime $p$.
- Rational $\pm$ irrational is irrational. Non-zero rational $\times$ or $\div$ irrational is irrational.
:::

:::trap
Theorem 1.2 needs $p$ to be **prime**. 4 divides $36 = 6^2$, but 4 does not divide 6.
:::

:::trap
Not every square root is irrational. $\sqrt4 = 2$, $\sqrt9 = 3$ and $\sqrt{\dfrac{9}{16}} = \dfrac34$ are rational.
:::

:::trap
Two irrationals can give a **rational** answer.
- $\sqrt2 + (-\sqrt2) = 0$
- $\sqrt2 \times \sqrt2 = 2$
- $(2 + \sqrt3)(2 - \sqrt3) = 4 - 3 = 1$

Only "rational with irrational" has a fixed rule. Always simplify first.
:::

## Writing the proof (marks are in the steps)

:::tip
For "Prove that $\sqrt3$ is irrational" (or $\sqrt5$, or $\sqrt7$), write all of these:
1. "Assume, to the contrary, that $\sqrt3$ is rational."
2. $\sqrt3 = \dfrac{a}{b}$, $b \ne 0$, and $a, b$ **coprime**.
3. Square: $3b^2 = a^2$. So 3 divides $a^2$, so 3 divides $a$ (Theorem 1.2).
4. Put $a = 3c$: $b^2 = 3c^2$, so 3 divides $b$ too.
5. 3 divides both $a$ and $b$. This **contradicts** "coprime". So $\sqrt3$ is irrational.
:::

:::trap
Do not skip "**$a$ and $b$ are coprime**". The contradiction at the end depends on it.
:::

:::tip
For $5 - \sqrt3$, $3\sqrt2$, $3 + 2\sqrt5$, $\dfrac{1}{\sqrt2}$: assume the number is $\dfrac{a}{b}$, make the root the subject, and show the root would be rational. You may **use** "$\sqrt2$ (or $\sqrt3$, $\sqrt5$) is irrational" as a known fact.
:::
