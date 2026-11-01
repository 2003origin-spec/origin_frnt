---
title: "Relations and Functions (Class 12): Quick Practice"
type: practice
chapter: c12.mathematics.relations-and-functions
order: 4
---

Try each question first, then tap **Show answer**.

## Relations

:::question{title="1. Which properties?" exam="JEE Main level"}
In $A = \{1, 2, 3, 4\}$, let
$R = \{(1, 1), (2, 2), (3, 3), (4, 4),$ $(1, 2), (2, 1), (2, 3), (3, 2)\}$.
Is $R$ reflexive, symmetric, transitive?

---

All four $(a, a)$ are present: reflexive. Every pair has its reverse: symmetric. But $(1, 2)$ and $(2, 3)$ are in $R$ while $(1, 3)$ is not.

**Reflexive and symmetric, but not transitive.**
:::

:::question{title="2. An equivalence class" exam="JEE Main level"}
In $A = \{1, 2, \dots, 20\}$, $R = \{(a, b) : 4 \text{ divides } a - b\}$. Find $[3]$ and the number of different equivalence classes.

---

$[3]$ = numbers in $A$ that leave remainder 3 on division by 4: **$\{3, 7, 11, 15, 19\}$**.

The remainders 0, 1, 2, 3 give **4 classes**.
:::

:::question{title="3. Squares" exam="JEE Main level"}
On $\mathbf{Z}$, $a\,R\,b$ if 3 divides $a^2 - b^2$. Show that $R$ is an equivalence relation and find the number of equivalence classes.

---

Reflexive: $a^2 - a^2 = 0$. Symmetric: $b^2 - a^2 = -(a^2 - b^2)$. Transitive: $a^2 - c^2 = (a^2 - b^2) + (b^2 - c^2)$, a sum of two multiples of 3.

On division by 3, $a^2$ leaves remainder 0 if 3 divides $a$, and 1 otherwise. So the classes are "multiples of 3" and "not multiples of 3": **2 classes**.
:::

:::question{title="4. Counting relations" exam="JEE Main level"}
How many relations on $A = \{1, 2, 3, 4\}$ are both reflexive and symmetric?

---

The 4 pairs $(a, a)$ must be in. The other 12 pairs come in 6 couples $\{(a, b), (b, a)\}$, and each couple is either fully in or fully out.

$2^6 =$ **64**.
:::

:::question{title="5. Equivalence relations with a pair" exam="JEE Main level"}
How many equivalence relations on $\{1, 2, 3, 4\}$ contain $(1, 2)$?

---

An equivalence relation is a split into groups, and 1, 2 must share a group. Treat $\{1, 2\}$ as one block, then split $\{\{1, 2\}, 3, 4\}$:

$\{12\}\{3\}\{4\}$, $\{123\}\{4\}$, $\{124\}\{3\}$, $\{12\}\{34\}$, $\{1234\}$.

**5**.
:::

## Functions

:::question{title="6. x times |x|" exam="JEE Main level"}
Is $f : \mathbf{R} \to \mathbf{R}$, $f(x) = x\,|x|$, one-one? Onto?

---

$f(x) = x^2$ for $x \ge 0$ and $-x^2$ for $x < 0$. It is strictly increasing, so one-one. Positive inputs give positive outputs and negative inputs give negative ones, so equal images need inputs of the same sign, and then $x_1 = x_2$.

Onto: for $y \ge 0$ take $x = \sqrt{y}$; for $y < 0$ take $x = -\sqrt{-y}$.

**Both: $f$ is bijective.**
:::

:::question{title="7. Onto functions" exam="JEE Main level"}
How many onto functions are there from $\{1, 2, 3, 4\}$ to $\{a, b, c\}$?

---

All functions: $3^4 = 81$. Remove those that miss at least one letter by inclusion–exclusion:
$81 - \binom31 2^4 + \binom32 1^4 = 81 - 48 + 3$.

Check: one letter gets 2 of the numbers. Choose the 2 numbers ($\binom42 = 6$), then match the 3 groups to $a, b, c$ ($3! = 6$): $36$.

**36**.
:::

:::question{title="8. Not one-one" exam="JEE Main level"}
$A$ has 3 elements and $B$ has 5. How many functions from $A$ to $B$ are **not** one-one?

---

All functions: $5^3 = 125$. One-one: $5 \times 4 \times 3 = 60$.

Not one-one: $125 - 60 =$ **65**.
:::

## Composition and inverse

:::question{title="9. Inverse of a composition" exam="JEE Main level"}
$f, g : \mathbf{R} \to \mathbf{R}$, $f(x) = 2x + 3$, $g(x) = x^3$. Find $(g \circ f)(x)$, $(f \circ g)(x)$ and $(g \circ f)^{-1}(64)$.

---

$(g \circ f)(x) = (2x + 3)^3$ and $(f \circ g)(x) = 2x^3 + 3$. They are different functions.

$(2x + 3)^3 = 64$ gives $2x + 3 = 4$, so $(g \circ f)^{-1}(64) =$ **$\frac12$**.

In general $(g \circ f)^{-1}(y) = \dfrac{\sqrt[3]{y} - 3}{2}$, which is $f^{-1}(g^{-1}(y))$.
:::

:::question{title="10. Inverse of a fraction" exam="JEE Main level"}
$f : \mathbf{R} - \{2\} \to \mathbf{R} - \{1\}$, $f(x) = \dfrac{x + 1}{x - 2}$. Show that $f$ is invertible and find $f^{-1}$.

---

One-one: cross-multiplying $\dfrac{x_1 + 1}{x_1 - 2} = \dfrac{x_2 + 1}{x_2 - 2}$ leaves $-3x_1 = -3x_2$, so $x_1 = x_2$.

Onto: $y = \dfrac{x + 1}{x - 2}$ gives $x(y - 1) = 2y + 1$, so $x = \dfrac{2y + 1}{y - 1}$, defined for every $y \ne 1$. This $x$ is never 2 (that would need $1 = -2$).

So $f$ is bijective, and **$f^{-1}(y) = \dfrac{2y + 1}{y - 1}$**.
:::
