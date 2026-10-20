---
title: "Integrals: Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.integrals
order: 1
---

In this chapter (as in NCERT), $\log x$ means the **natural logarithm** $\log_e x$. $C$ is the constant of integration.

## Integral as an anti derivative

:::formula{title="Definition"}
$$\frac{d}{dx}F(x) = f(x)$$
$$\int f(x)\,dx = F(x) + C$$
Any two anti derivatives of $f$ on an interval differ by a constant.
:::

:::formula{title="Linearity"}
$$\int [f(x) + g(x)]\,dx = \int f\,dx + \int g\,dx$$
$$\int k\,f(x)\,dx = k\int f(x)\,dx$$
$k$ = any real constant.
:::

## Standard integrals

:::formula{title="Powers"}
$$\int x^n\,dx = \frac{x^{n+1}}{n+1} + C \quad (n \ne -1)$$
$$\int dx = x + C$$
$$\int \frac{1}{x}\,dx = \log|x| + C \quad (x \ne 0)$$
:::

:::formula{title="Exponentials"}
$$\int e^x\,dx = e^x + C$$
$$\int a^x\,dx = \frac{a^x}{\log a} + C$$
For $a^x$: $a > 0$, $a \ne 1$.
:::

:::formula{title="Trigonometric"}
$$\int \cos x\,dx = \sin x + C$$
$$\int \sin x\,dx = -\cos x + C$$
$$\int \sec^2 x\,dx = \tan x + C$$
$$\int \operatorname{cosec}^2 x\,dx = -\cot x + C$$
$$\int \sec x \tan x\,dx = \sec x + C$$
$$\int \operatorname{cosec} x \cot x\,dx = -\operatorname{cosec} x + C$$
:::

:::formula{title="Inverse trigonometric"}
$$\int \frac{dx}{\sqrt{1 - x^2}} = \sin^{-1} x + C$$
$$\int \frac{dx}{1 + x^2} = \tan^{-1} x + C$$
The first needs $|x| < 1$. NCERT also writes them as $-\cos^{-1} x + C$ and $-\cot^{-1} x + C$ (same up to a constant).
:::

:::formula{title="tan, cot, sec, cosec"}
$$\int \tan x\,dx = \log|\sec x| + C$$
$$\int \cot x\,dx = \log|\sin x| + C$$
$$\int \sec x\,dx = \log|\sec x + \tan x| + C$$
$$\begin{aligned} &\int \operatorname{cosec} x\,dx \\ &= \log|\operatorname{cosec} x - \cot x| + C \end{aligned}$$
:::

## Substitution results

:::formula{title="Linear substitution"}
If $\int f(x)\,dx = F(x) + C$, then
$$\int f(ax + b)\,dx = \frac{1}{a}F(ax + b) + C$$
For $a \ne 0$. Example: $\int \cos 3x\,dx = \frac13 \sin 3x + C$.
:::

:::formula{title="Derivative on top"}
$$\int \frac{f'(x)}{f(x)}\,dx = \log|f(x)| + C$$
$$\int [f(x)]^n f'(x)\,dx = \frac{[f(x)]^{n+1}}{n+1} + C$$
The second needs $n \ne -1$.
:::

## Trigonometric identities used

:::formula{title="Squares and cubes"}
$$\sin^2 x = \frac{1 - \cos 2x}{2}$$
$$\cos^2 x = \frac{1 + \cos 2x}{2}$$
$$\sin^3 x = \frac{3\sin x - \sin 3x}{4}$$
$$\cos^3 x = \frac{3\cos x + \cos 3x}{4}$$
:::

:::formula{title="Products to sums"}
$$2\sin A\cos B = \sin(A + B) + \sin(A - B)$$
$$2\cos A\cos B = \cos(A + B) + \cos(A - B)$$
$$2\sin A\sin B = \cos(A - B) - \cos(A + B)$$
:::

## Integrals of some particular functions

Here $a > 0$.

:::formula{title="1. Difference of squares, x first"}
$$\begin{aligned} &\int \frac{dx}{x^2 - a^2} \\ &= \frac{1}{2a}\log\left|\frac{x - a}{x + a}\right| + C \end{aligned}$$
:::

:::formula{title="2. Difference of squares, a first"}
$$\begin{aligned} &\int \frac{dx}{a^2 - x^2} \\ &= \frac{1}{2a}\log\left|\frac{a + x}{a - x}\right| + C \end{aligned}$$
:::

:::formula{title="3. Sum of squares"}
$$\int \frac{dx}{x^2 + a^2} = \frac{1}{a}\tan^{-1}\frac{x}{a} + C$$
:::

:::formula{title="4. Root of x² − a²"}
$$\begin{aligned} &\int \frac{dx}{\sqrt{x^2 - a^2}} \\ &= \log\left|x + \sqrt{x^2 - a^2}\right| + C \end{aligned}$$
For $|x| > a$.
:::

:::formula{title="5. Root of a² − x²"}
$$\int \frac{dx}{\sqrt{a^2 - x^2}} = \sin^{-1}\frac{x}{a} + C$$
For $|x| < a$.
:::

:::formula{title="6. Root of x² + a²"}
$$\begin{aligned} &\int \frac{dx}{\sqrt{x^2 + a^2}} \\ &= \log\left|x + \sqrt{x^2 + a^2}\right| + C \end{aligned}$$
:::

:::formula{title="Quadratic in the denominator"}
For $\int \dfrac{dx}{ax^2 + bx + c}$ or $\int \dfrac{dx}{\sqrt{ax^2 + bx + c}}$, complete the square:
$$\begin{aligned} &ax^2 + bx + c \\ &= a\left(x + \frac{b}{2a}\right)^2 + c - \frac{b^2}{4a} \end{aligned}$$
Then put $t = x + \dfrac{b}{2a}$ and use 1 to 6.
:::

:::formula{title="Linear over quadratic"}
For $\int \dfrac{px + q}{ax^2 + bx + c}\,dx$ (or with a square root below), write
$$px + q = A\,(2ax + b) + B$$
Find $A$ and $B$ by comparing the coefficient of $x$ and the constant term.
:::

## Partial fractions

For a **proper** fraction (degree of top < degree of bottom). $A, B, C$ are constants to find.

:::formula{title="The five forms (NCERT Table 7.2)"}
$$\frac{px + q}{(x - a)(x - b)} = \frac{A}{x - a} + \frac{B}{x - b}$$
$$\frac{px + q}{(x - a)^2} = \frac{A}{x - a} + \frac{B}{(x - a)^2}$$
$$\begin{aligned} &\frac{px^2 + qx + r}{(x - a)(x - b)(x - c)} \\ &= \frac{A}{x - a} + \frac{B}{x - b} + \frac{C}{x - c} \end{aligned}$$
$$\begin{aligned} &\frac{px^2 + qx + r}{(x - a)^2(x - b)} \\ &= \frac{A}{x - a} + \frac{B}{(x - a)^2} + \frac{C}{x - b} \end{aligned}$$
$$\begin{aligned} &\frac{px^2 + qx + r}{(x - a)(x^2 + bx + c)} \\ &= \frac{A}{x - a} + \frac{Bx + C}{x^2 + bx + c} \end{aligned}$$
In the first and third forms the factors are different ($a \ne b$, and so on). In the last form, $x^2 + bx + c$ cannot be factorised.
:::

## Integration by parts

:::formula{title="By parts"}
$$\begin{aligned} &\int f(x)\,g(x)\,dx \\ &= f(x)\int g\,dx - \int\left[f'(x)\int g\,dx\right]dx \end{aligned}$$
$f$ = first function, $g$ = second function (one you can integrate).
:::

:::formula{title="The e^x [f + f′] type"}
$$\int e^x\left[f(x) + f'(x)\right]dx = e^x f(x) + C$$
:::

:::formula{title="Square-root forms"}
$$\begin{aligned} &\int \sqrt{x^2 - a^2}\,dx \\ &= \frac{x}{2}\sqrt{x^2 - a^2} \\ &\quad - \frac{a^2}{2}\log\left|x + \sqrt{x^2 - a^2}\right| + C \end{aligned}$$
$$\begin{aligned} &\int \sqrt{x^2 + a^2}\,dx \\ &= \frac{x}{2}\sqrt{x^2 + a^2} \\ &\quad + \frac{a^2}{2}\log\left|x + \sqrt{x^2 + a^2}\right| + C \end{aligned}$$
$$\begin{aligned} &\int \sqrt{a^2 - x^2}\,dx \\ &= \frac{x}{2}\sqrt{a^2 - x^2} \\ &\quad + \frac{a^2}{2}\sin^{-1}\frac{x}{a} + C \end{aligned}$$
Here $a > 0$. The first needs $|x| \ge a$, the third $|x| \le a$.
:::

:::formula{title="e^(ax) with sin or cos (exam extra)"}
Not in NCERT as a formula: it is by parts used twice, as NCERT does for $\int e^x \sin x\,dx$.
$$\begin{aligned} &\int e^{ax}\sin bx\,dx \\ &= \frac{e^{ax}}{a^2 + b^2}\,(a\sin bx - b\cos bx) + C \end{aligned}$$
$$\begin{aligned} &\int e^{ax}\cos bx\,dx \\ &= \frac{e^{ax}}{a^2 + b^2}\,(a\cos bx + b\sin bx) + C \end{aligned}$$
For $a^2 + b^2 \ne 0$.
:::

## Definite integrals

:::formula{title="First fundamental theorem"}
$$A(x) = \int_a^x f(t)\,dt$$
$$A'(x) = f(x) \quad \text{for all } x \in [a, b]$$
$f$ continuous on $[a, b]$. $A(x)$ is the area function. (NCERT writes $f(x)\,dx$ inside; same thing, by P0.)
:::

:::formula{title="Second fundamental theorem"}
$$\int_a^b f(x)\,dx = \Big[F(x)\Big]_a^b = F(b) - F(a)$$
$f$ continuous on $[a, b]$ and $F' = f$. No $+C$ is needed: it cancels.
:::

:::formula{title="P0 to P2"}
$$\int_a^b f(x)\,dx = \int_a^b f(t)\,dt$$
$$\int_a^b f(x)\,dx = -\int_b^a f(x)\,dx$$
$$\int_a^a f(x)\,dx = 0$$
$$\int_a^b f\,dx = \int_a^c f\,dx + \int_c^b f\,dx$$
:::

:::formula{title="P3 and P4"}
$$\int_a^b f(x)\,dx = \int_a^b f(a + b - x)\,dx$$
$$\int_0^a f(x)\,dx = \int_0^a f(a - x)\,dx$$
:::

:::formula{title="P5 and P6"}
$$\begin{aligned} \int_0^{2a} f(x)\,dx &= \int_0^a f(x)\,dx \\ &\quad + \int_0^a f(2a - x)\,dx \end{aligned}$$
If $f(2a - x) = f(x)$:
$$\int_0^{2a} f(x)\,dx = 2\int_0^a f(x)\,dx$$
If $f(2a - x) = -f(x)$:
$$\int_0^{2a} f(x)\,dx = 0$$
:::

:::formula{title="P7: even and odd functions"}
If $f(-x) = f(x)$ (even):
$$\int_{-a}^{a} f(x)\,dx = 2\int_0^a f(x)\,dx$$
If $f(-x) = -f(x)$ (odd):
$$\int_{-a}^{a} f(x)\,dx = 0$$
:::

:::formula{title="A standard result (NCERT Example 34)"}
$$\int_0^{\pi/2} \log \sin x\,dx = -\frac{\pi}{2}\log 2$$
The same value for $\log \cos x$ (by P4).
:::

## Exam extras

Not in NCERT; in the JEE Main syllabus under "fundamental theorem of calculus" and "properties of definite integrals".

:::formula{title="Limits that are functions of x"}
$$\begin{aligned} &\frac{d}{dx}\int_{g(x)}^{h(x)} f(t)\,dt \\ &= f(h(x))\,h'(x) - f(g(x))\,g'(x) \end{aligned}$$
$f$ continuous, $g$ and $h$ differentiable. It follows from the first fundamental theorem and the chain rule.
:::

:::formula{title="Periodic functions"}
If $f$ is continuous and $f(x + T) = f(x)$ for all $x$, then for any whole number $n$ and any real $a$:
$$\int_0^{nT} f(x)\,dx = n\int_0^{T} f(x)\,dx$$
$$\int_a^{a + T} f(x)\,dx = \int_0^{T} f(x)\,dx$$
:::
