---
title: "Relations and Functions (Class 12): Short Notes"
type: short_notes
chapter: c12.mathematics.relations-and-functions
order: 2
---

## 1. Relations (recap)

- A **relation** from $A$ to $B$ is any subset of $A \times B$. A relation **in** (or on) a set $A$ is a subset of $A \times A$.
- If $(a, b) \in R$, we write $a\,R\,b$. The pairs need not have any "real-life" link; any subset counts.
- NCERT also writes a relation as "$a\,R\,b$ if and only if $b = a + 1$" instead of listing the pairs.

## 2. Empty and universal relations

- **Empty relation:** no element is related to any element, $R = \phi$. Example: "$a$ is a sister of $b$" in a boys' school.
- **Universal relation:** every element is related to every element, $R = A \times A$. Example: $|a - b| \ge 0$ in any set of numbers.
- Both are called **trivial** relations.

## 3. Reflexive, symmetric, transitive

For a relation $R$ in a set $A$:
- **Reflexive:** $(a, a) \in R$ for **every** $a \in A$.
- **Symmetric:** whenever $(a, b) \in R$, also $(b, a) \in R$.
- **Transitive:** whenever $(a, b) \in R$ and $(b, c) \in R$, also $(a, c) \in R$.

How to check a listed relation on a small set:
- Reflexive: tick off $(a, a)$ for each element of $A$.
- Symmetric: for each pair $(a, b)$, look for $(b, a)$.
- Transitive: for each pair $(a, b)$, look at every pair starting with $b$.

Examples from NCERT:

| Relation | R | S | T |
|---|---|---|---|
| $T_1$ congruent to $T_2$ | yes | yes | yes |
| $L_1 \perp L_2$ | no | yes | no |
| $a \le b$ on $\mathbf{R}$ | yes | no | yes |
| $\{(1, 2), (2, 1)\}$ in $\{1, 2, 3\}$ | no | yes | no |

R, S, T = reflexive, symmetric, transitive.

- Perpendicular lines are not transitive: $L_1 \perp L_2$ and $L_2 \perp L_3$ make $L_1$ **parallel** to $L_3$.
- $\{(1, 2), (2, 1)\}$ is not transitive: $(1, 2)$ and $(2, 1)$ would need $(1, 1)$.

## 4. Equivalence relations and classes

- An **equivalence relation** is reflexive, symmetric and transitive.
- Typical examples: "is congruent to", "is similar to", "is parallel to" (NCERT counts a line as parallel to itself), "has the same number of pages as", "$a - b$ is divisible by $m$" on $\mathbf{Z}$.
- The **equivalence class** $[a]$ is the set of all elements related to $a$.
- An equivalence relation cuts the set into **disjoint** classes that together make up the whole set (a **partition**):
  - all elements inside one class are related to each other;
  - no element of one class is related to an element of another class.
- It works backwards too: every partition of a set gives an equivalence relation ("lie in the same part").

:::example{title="Divisible by 2 on Z"}
$R = \{(a, b) : 2 \text{ divides } a - b\}$. Then $[0]$ = all even integers and $[1]$ = all odd integers. $[0] = [2] = [-4]$ and $[1] = [3] = [-7]$. Only 2 different classes.
:::

- Two general facts from NCERT's miscellaneous examples:
  - if $R_1$, $R_2$ are equivalence relations in $A$, so is $R_1 \cap R_2$;
  - for any function $f$ on $X$, "$f(a) = f(b)$" is an equivalence relation in $X$.

## 5. One-one and onto functions

For $f : X \to Y$:
- **One-one (injective):** different inputs give different outputs. To prove it, start from $f(x_1) = f(x_2)$ and reach $x_1 = x_2$. To disprove it, find two different inputs with the same image.
- **Many-one:** not one-one.
- **Onto (surjective):** every element of the codomain $Y$ is an image, so the range equals $Y$. To prove it, take any $y \in Y$, solve $f(x) = y$, and check that the $x$ found is in $X$.
- **Bijective:** both one-one and onto.

:::example{title="Same rule, different sets"}
$f(x) = 2x$ is one-one but **not onto** from $\mathbf{N}$ to $\mathbf{N}$ (1 has no preimage). From $\mathbf{R}$ to $\mathbf{R}$ it is **bijective** ($x = y/2$).
:::

## 6. Standard functions checked

| Function | One-one | Onto |
|---|---|---|
| $x^2$, $\mathbf{N} \to \mathbf{N}$ | yes | no |
| $x^2$, $\mathbf{R} \to \mathbf{R}$ | no | no |
| $x^3$, $\mathbf{Z} \to \mathbf{Z}$ | yes | no |
| $x^3$, $\mathbf{R} \to \mathbf{R}$ | yes | yes |
| $\lvert x \rvert$, $\mathbf{R} \to \mathbf{R}$ | no | no |
| $[x]$, $\mathbf{R} \to \mathbf{R}$ | no | no |
| $3 - 4x$, $\mathbf{R} \to \mathbf{R}$ | yes | yes |
| $1 + x^2$, $\mathbf{R} \to \mathbf{R}$ | no | no |

- $x^2$ on $\mathbf{R}$: $f(-1) = f(1)$, and $-2$ is never an image.
- $|x|$ and $[x]$: $f(-1) = f(1)$ and $[0.2] = [0.7]$; negative numbers (for $|x|$) and non-integers (for $[x]$) are never images.
- The signum function $\mathbf{R} \to \mathbf{R}$ is also neither: its range is only $\{-1, 0, 1\}$.

## 7. Finite and infinite sets

- For a **finite** set $X$, a function $f : X \to X$ is one-one **if and only if** it is onto. (NCERT Examples 13 and 14 do $X = \{1, 2, 3\}$.)
- For an **infinite** set this fails: $f(x) = 2x$ on $\mathbf{N}$ is one-one, not onto; $f(1) = f(2) = 1$, $f(x) = x - 1$ for $x > 2$ on $\mathbf{N}$ is onto, not one-one.
- A one-one function from $\{1, 2, \dots, n\}$ to itself is a permutation, so there are $n!$ of them, and these are exactly the onto ones too.

## 8. Composition

- For $f : A \to B$ and $g : B \to C$, the composition $g \circ f : A \to C$ is $(g \circ f)(x) = g(f(x))$. NCERT writes it **gof**.
- Read it right to left: **$f$ acts first**.
- Usually $g \circ f \ne f \circ g$. Sometimes only one of them is even defined.

:::example{title="NCERT-style composition"}
$f(x) = \cos x$, $g(x) = 3x^2$ on $\mathbf{R}$:
$(g \circ f)(x) = 3\cos^2 x$ but $(f \circ g)(x) = \cos(3x^2)$. At $x = 0$ they give 3 and 1.
:::

## 9. Invertible functions

- $f : X \to Y$ is **invertible** if there is $g : Y \to X$ with $g \circ f = I_X$ and $f \circ g = I_Y$. Then $g = f^{-1}$.
- $f$ is invertible **exactly when it is bijective**. So to show a function is invertible, it is enough to show one-one and onto.
- To find $f^{-1}$: put $y = f(x)$, solve for $x$, then write $f^{-1}(y)$ = that expression.

:::example{title="Inverse of 4x + 3"}
$f : \mathbf{N} \to Y$, $f(x) = 4x + 3$, where $Y$ = range of $f$ $= \{7, 11, 15, \dots\}$.
From $y = 4x + 3$: $x = \dfrac{y - 3}{4}$, so $f^{-1}(y) = \dfrac{y - 3}{4}$. Taking $Y$ as the range makes $f$ onto.
:::

## 10. Sums of functions

- The sum of two onto functions need not be onto: $I_{\mathbf{N}}$ is onto but $(I_{\mathbf{N}} + I_{\mathbf{N}})(x) = 2x$ on $\mathbf{N}$ is not.
- The sum of two one-one functions need not be one-one: $\sin x$ and $\cos x$ are one-one on $[0, \frac{\pi}{2}]$, but $\sin x + \cos x$ is 1 at both $0$ and $\frac{\pi}{2}$.

:::remember
The 2025-26 NCERT book still mentions **binary operations** in its introduction and summary, but that section was removed in the rationalised syllabus. It is not in the JEE Main 2026 syllabus either.
:::
