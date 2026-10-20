---
title: "Binomial Theorem: Short Notes"
type: short_notes
chapter: c11.mathematics.binomial-theorem
order: 2
---

## 1. Why we need it

- A **binomial** is a sum of two terms, like $a + b$ or $2x - 3y$.
- Squares and cubes are easy to expand by hand. Powers like $(98)^5$ or $(2x + 3y)^{12}$ are not.
- The binomial theorem gives every term of $(a + b)^n$ directly. NCERT studies it only for a **positive integer** index $n$.

## 2. Pascal's triangle

Write the coefficients of $(a + b)^n$ row by row:

- $n = 0$: 1
- $n = 1$: 1, 1
- $n = 2$: 1, 2, 1
- $n = 3$: 1, 3, 3, 1
- $n = 4$: 1, 4, 6, 4, 1
- $n = 5$: 1, 5, 10, 10, 5, 1
- $n = 6$: 1, 6, 15, 20, 15, 6, 1

- Each row starts and ends with 1.
- Every other number is the **sum of the two numbers just above it**.
- Each row reads the same from both ends.
- NCERT: this array is called **Pascal's triangle**, after Blaise Pascal. It is also known as **Meru Prastara**, given by **Pingla**.

:::example{title="Using a row"}
Row 5 is 1, 5, 10, 10, 5, 1. So
$$\begin{aligned} (2x+3y)^5 &= 32x^5 + 240x^4y \\ &\quad + 720x^3y^2 + 1080x^2y^3 \\ &\quad + 810xy^4 + 243y^5 \end{aligned}$$
:::

## 3. The numbers in the triangle are nCr

- The numbers in row $n$ are ${}^nC_0, {}^nC_1, \dots, {}^nC_n$, where ${}^nC_r = \dfrac{n!}{r!\,(n-r)!}$.
- So we can write any row directly, without the rows above it.
- "Each number is the sum of the two above it" is the rule ${}^nC_r + {}^nC_{r-1} = {}^{n+1}C_r$.

## 4. The binomial theorem

For any positive integer $n$:
$$(a+b)^n = \sum_{k=0}^{n} {}^nC_k\, a^{n-k}\, b^k$$

- The numbers ${}^nC_k$ are called the **binomial coefficients**.
- NCERT proves the theorem by **mathematical induction**. The key step multiplies the expansion of $(a + b)^k$ by $(a + b)$ and joins like terms using Pascal's rule.

**What every expansion looks like (NCERT observations):**
- There are $n + 1$ terms, one more than the index.
- The power of $a$ falls by 1 from term to term: $n, n-1, \dots, 0$.
- The power of $b$ rises by 1: $0, 1, \dots, n$.
- In every term, the two powers add up to $n$.

:::example{title="(x + 2)⁶"}
$(x+2)^6 = x^6 + 12x^5 + 60x^4 + 160x^3 + 240x^2 + 192x + 64$
:::

## 5. Special cases

| Put | You get |
|---|---|
| $a = x,\ b = -y$ | $(x - y)^n$: signs alternate |
| $a = 1,\ b = x$ | $(1+x)^n = \sum {}^nC_k x^k$ |
| $a = 1,\ b = -x$ | $(1-x)^n = \sum (-1)^k\,{}^nC_k x^k$ |

- Putting $x = 1$ in $(1 + x)^n$: ${}^nC_0 + {}^nC_1 + \cdots + {}^nC_n = 2^n$.
- Putting $x = 1$ in $(1 - x)^n$: ${}^nC_0 - {}^nC_1 + {}^nC_2 - \cdots = 0$ (for $n \ge 1$).
- Other values work too. Putting $x = 3$ in $(1 + x)^n$ gives $\sum 3^r\,{}^nC_r = 4^n$ (NCERT Exercise 7.1).

## 6. Using the theorem (NCERT examples and exercises)

**Working out a big power.** Split the number into an easy part plus or minus a small part.

:::example{title="(98)⁵"}
$98 = 100 - 2$, so expand $(100 - 2)^5$:
$$(98)^5 = 9039207968$$
:::

**Comparing numbers.** Keep the first few terms. If every term left out is positive, what you kept is smaller than the whole.

:::example{title="Which is larger?"}
$(1.01)^{1000000} = 1 + 1000000 \times 0.01 + (\text{positive terms})$, which is more than $10001$. So $(1.01)^{1000000} > 10000$.
:::

**Divisibility and remainders.** Write the base as $1 +$ (a multiple of the divisor). For example, $6^n = (1 + 5)^n = 1 + 5n + 25\,(\dots)$, so $6^n - 5n$ leaves remainder 1 when divided by 25.

**Approximation.** For a number close to 1, the first few terms give a good value:
$$(0.99)^5 \approx 1 - 5(0.01) + 10(0.01)^2 = 0.951$$
(The true value is $0.95099\dots$)

**Sum and difference of two expansions.** In $(a+b)^n + (a-b)^n$ the terms with odd powers of $b$ cancel. In $(a+b)^n - (a-b)^n$ the terms with even powers of $b$ cancel. This makes expressions like $(\sqrt3 + \sqrt2)^4 - (\sqrt3 - \sqrt2)^4$ quick.

**Three terms.** Group two of them as one: $(3x^2 - 2ax + 3a^2)^3 = \left[3x^2 + (3a^2 - 2ax)\right]^3$, then expand twice.

**A factor result.** If $a$ and $b$ are distinct integers and $n$ is a positive integer, $a - b$ is a factor of $a^n - b^n$. Write $a = (a - b) + b$ and expand $a^n$: every term except $b^n$ has the factor $a - b$.

## 7. General and middle terms (exam extra)

Exam extra: in the JEE Main syllabus ("general term and middle term"), not in NCERT. The older NCERT book had this section; the rationalised book removed it.

- **General term:** $T_{r+1} = {}^nC_r\, a^{n-r} b^r$. It is the $(r + 1)$th term, so the 7th term uses $r = 6$.
- **Coefficient of $x^k$:** write $T_{r+1}$, collect all the powers of $x$ into one power, set it equal to $k$, and solve for $r$. A valid $r$ must be a whole number from $0$ to $n$. If there is none, the coefficient is $0$.
- **Term independent of $x$** (the constant term): the same, with the power of $x$ set to 0.
- **Middle term:** for even $n$ it is $T_{\frac n2 + 1}$. For odd $n$ there are two: $T_{\frac{n+1}{2}}$ and $T_{\frac{n+3}{2}}$.

:::example{title="Constant term of (x² + 1/x)⁶"}
$T_{r+1} = {}^6C_r\,(x^2)^{6-r}\,x^{-r} = {}^6C_r\, x^{12 - 3r}$.

$12 - 3r = 0$ gives $r = 4$, so the constant term is $T_5 = {}^6C_4 = 15$.
:::

## 8. More coefficient results (exam extra)

Not in NCERT. JEE Main uses them as "simple applications".

- Sum of all the coefficients of an expansion: put every variable equal to 1.
- ${}^nC_0 + {}^nC_2 + \cdots = {}^nC_1 + {}^nC_3 + \cdots = 2^{n-1}$ (for $n \ge 1$).
- $\sum k\,{}^nC_k = n\,2^{n-1}$ and $\sum ({}^nC_k)^2 = {}^{2n}C_n$.
- The largest binomial coefficient is the middle one: ${}^nC_{n/2}$ for even $n$. For odd $n$ the two middle ones, ${}^nC_{(n-1)/2}$ and ${}^nC_{(n+1)/2}$, are equal and largest.
