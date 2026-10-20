---
title: "Integrals: Short Notes"
type: short_notes
chapter: c12.mathematics.integrals
order: 2
---

## 1. Integration as the inverse of differentiation

- If $\dfrac{d}{dx}F(x) = f(x)$ on an interval, $F$ is an **anti derivative** (or primitive) of $f$.
- $F + C$ is also an anti derivative for every real $C$. The whole family is the **indefinite integral**: $\int f(x)\,dx = F(x) + C$.
- Functions with the same derivative on an interval differ only by a constant, so $F + C$ gives **all** the anti derivatives.
- One extra condition, such as $F(0) = 3$, fixes $C$ and gives one function.
- **Inspection:** guess a function whose derivative is the integrand. Example: $\dfrac{d}{dx}\left(\tfrac12 \sin 2x\right) = \cos 2x$, so $\int \cos 2x\,dx = \tfrac12 \sin 2x + C$.
- Some integrals, such as $\int e^{-x^2}\,dx$, have no answer in terms of elementary functions.

| Term | Meaning |
|---|---|
| Integrand | $f(x)$ in $\int f(x)\,dx$ |
| Variable of integration | $x$ in $\int f(x)\,dx$ |
| Constant of integration | $C$, any real number |

## 2. Properties of the indefinite integral

- $\dfrac{d}{dx}\int f(x)\,dx = f(x)$ and $\int f'(x)\,dx = f(x) + C$.
- The integral of a sum is the sum of the integrals. A constant factor comes outside.
- There is **no** product rule or quotient rule for integrals. Products need substitution, identities or parts.

## 3. Integration by substitution

- Put $x = g(t)$, so $dx = g'(t)\,dt$:
$$\int f(x)\,dx = \int f(g(t))\,g'(t)\,dt$$
- Choose a part of the integrand **whose derivative is also present**. Change everything, including $dx$, into $t$.
- After integrating, put the old variable back.

:::example{title="Derivative present"}
$\int 2x\sin(x^2 + 1)\,dx$: put $t = x^2 + 1$, $dt = 2x\,dx$. The integral is $\int \sin t\,dt = -\cos(x^2 + 1) + C$.
:::

- **tan, cot, sec, cosec** come from substitution. For $\int \sec x\,dx$, multiply top and bottom by $\sec x + \tan x$ and put $t = \sec x + \tan x$.

## 4. Using trigonometric identities

- Squares: use $\sin^2 x = \dfrac{1 - \cos 2x}{2}$ and $\cos^2 x = \dfrac{1 + \cos 2x}{2}$.
- Products like $\sin 2x \cos 3x$: change to a sum, then integrate each term.
- Cubes: $\sin^3 x = \dfrac{3\sin x - \sin 3x}{4}$. Or write $\sin^3 x = (1 - \cos^2 x)\sin x$ and put $t = \cos x$.

:::tip
In $\int \sin^m x\cos^n x\,dx$ with one **odd** power: keep one factor of that function aside, change the rest with $\sin^2 x + \cos^2 x = 1$, and put $t$ = the other function. Both powers even: use the double-angle forms.
:::

## 5. Integrals of particular functions

- The six results with $x^2 \pm a^2$ and $a^2 - x^2$ (formula sheet) come from partial fractions or from $x = a\tan\theta$, $a\sec\theta$, $a\sin\theta$.
- For $\dfrac{1}{ax^2 + bx + c}$ or $\dfrac{1}{\sqrt{ax^2 + bx + c}}$: take $a$ out, complete the square, put $t = x + \dfrac{b}{2a}$. The sign of the leftover constant decides which result to use.
- For $\dfrac{px + q}{ax^2 + bx + c}$: write $px + q = A(2ax + b) + B$. The $A$ part is "derivative over function" (a log, or $2A\sqrt{\cdot}$ under a root). The $B$ part is the previous case.

:::example{title="Completing the square"}
$x^2 - 6x + 13 = (x - 3)^2 + 2^2$, so $\displaystyle\int \frac{dx}{x^2 - 6x + 13} = \frac12\tan^{-1}\frac{x - 3}{2} + C$.
:::

## 6. Partial fractions

- A rational function $\dfrac{P(x)}{Q(x)}$ is **proper** if the degree of $P$ is less than that of $Q$.
- **Improper?** Divide first: $\dfrac{P}{Q} = T(x) + \dfrac{P_1}{Q}$, with $T$ a polynomial and $\dfrac{P_1}{Q}$ proper.
- Split the proper part using the five forms of NCERT Table 7.2. Then each piece is a log, a power or a $\tan^{-1}$.
- Find the constants by putting convenient values of $x$ (the roots of the factors), or by comparing coefficients.

:::example{title="Two linear factors"}
$\dfrac{1}{(x + 1)(x + 2)} = \dfrac{1}{x + 1} - \dfrac{1}{x + 2}$, so the integral is $\log\left|\dfrac{x + 1}{x + 2}\right| + C$.
:::

## 7. Integration by parts

- From the product rule: integral of (first × second) = first × (integral of second) − integral of [(derivative of first) × (integral of second)].
- No constant is needed when you integrate the second function inside the formula; it cancels out.
- **Choosing the first function (NCERT):** a power of $x$ or a polynomial is usually first. But if the other function is an inverse trigonometric or a log function, take that one first.
- For $\int \log x\,dx$ or $\int \tan^{-1} x\,dx$, take $1$ as the second function: $\int \log x\,dx = x\log x - x + C$.
- **Loop integrals:** in $\int e^x \sin x\,dx$, parts twice brings back the same integral $I$. Solve for $I$: $I = \tfrac12 e^x(\sin x - \cos x) + C$.
- **$e^x[f + f']$ type:** if the integrand is $e^x$ times (a function + its derivative), the answer is $e^x f(x) + C$ at once.

:::example{title="e^x [f + f′]"}
$\int e^x\left(\tan^{-1}x + \dfrac{1}{1 + x^2}\right)dx = e^x\tan^{-1}x + C$, since $(\tan^{-1}x)' = \dfrac{1}{1 + x^2}$.
:::

- **Square roots:** $\int\sqrt{x^2 \pm a^2}\,dx$ and $\int\sqrt{a^2 - x^2}\,dx$ are found by parts with $1$ as the second function. For $\int\sqrt{ax^2 + bx + c}\,dx$, complete the square first.

## 8. The definite integral

- $\int_a^b f(x)\,dx$ has a **single value** (a number, no $C$). $a$ is the lower limit and $b$ the upper limit.
- For $f(x) \ge 0$ on $[a, b]$, it is the area between $y = f(x)$, the $x$-axis and the lines $x = a$, $x = b$.
- **Area function:** $A(x) = \int_a^x f(t)\,dt$. First fundamental theorem: $A'(x) = f(x)$.
- **Second fundamental theorem:** $\int_a^b f(x)\,dx = F(b) - F(a)$, where $F' = f$. Steps: find an anti derivative, put in the upper limit, subtract its value at the lower limit.
- $f$ must be defined and continuous on all of $[a, b]$.
- NCERT's current edition only mentions the "limit of a sum" definition and does not develop it. It is not in the JEE Main 2026 syllabus either.

## 9. Definite integrals by substitution

- Substitute as usual, and **change the limits** to the new variable. Then there is no need to go back to $x$.

:::example{title="Changing the limits"}
$\int_0^1 \dfrac{\tan^{-1}x}{1 + x^2}\,dx$: put $t = \tan^{-1}x$. When $x = 0$, $t = 0$; when $x = 1$, $t = \frac{\pi}{4}$. So the integral is $\int_0^{\pi/4} t\,dt = \dfrac{\pi^2}{32}$.
:::

## 10. Properties of definite integrals

| Property | Use it when |
|---|---|
| P2 (split at $c$) | $\lvert\cdot\rvert$, $[x]$, or a rule that changes at $c$ |
| P3, P4 ($x \to a + b - x$) | the integrand changes into a "partner" |
| P6 | the limits are $0$ to $2a$ |
| P7 (even, odd) | the limits are $-a$ to $a$ |

- **P3/P4 trick:** call the integral $I$, apply the property to get a second form, add the two forms, and solve for $I$. Example: $\int_0^{\pi/2} \dfrac{\sin^4 x}{\sin^4 x + \cos^4 x}\,dx = \dfrac{\pi}{4}$.
- **Odd parts vanish** on $[-a, a]$: $x^3$, $\sin x$, $x\cos x$, $\tan^5 x$ are odd. Split the integrand into odd and even parts first.
- **Modulus:** find where the expression inside is zero, split there (P2), and drop the modulus with the right sign on each piece.
