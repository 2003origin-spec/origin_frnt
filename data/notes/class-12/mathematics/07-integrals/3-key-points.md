---
title: "Integrals: Important Points and Traps"
type: key_points
chapter: c12.mathematics.integrals
order: 3
---

## Indefinite integrals

:::remember
- Integration is the inverse of differentiation. **Check any answer by differentiating it**: you must get the integrand back.
- Write $+ C$ once, at the end, in every indefinite integral.
- Two correct answers can look different and still differ only by a constant: $\sin^{-1}x$ and $-\cos^{-1}x$; $\frac12\sin^2 x$ and $-\frac14\cos 2x$.
:::

:::trap
$\int x^n\,dx = \dfrac{x^{n+1}}{n+1}$ fails for $n = -1$. Then the answer is $\log|x|$, with the **modulus**.
:::

:::trap
$\int a^x\,dx = \dfrac{a^x}{\log a} + C$, not $\dfrac{a^{x+1}}{x+1}$. Here the variable is in the power, so the power rule does not apply.
:::

:::trap
Signs to remember: $\int \sin x\,dx = -\cos x$, $\int \operatorname{cosec}^2 x\,dx = -\cot x$, $\int \operatorname{cosec} x\cot x\,dx = -\operatorname{cosec} x$. The integral of $\tan x$ is $\log|\sec x|$, which equals $-\log|\cos x|$.
:::

:::trap
$\int \dfrac{dx}{x^2 - a^2}$ and $\int \dfrac{dx}{a^2 - x^2}$ have the fraction inside the log the other way up: $\dfrac{x - a}{x + a}$ and $\dfrac{a + x}{a - x}$. Reason: $\dfrac{1}{a^2 - x^2} = -\dfrac{1}{x^2 - a^2}$, and the minus sign turns the fraction in the log upside down. So the minus bracket is **on top** for $x^2 - a^2$ and **at the bottom** for $a^2 - x^2$.
:::

## Substitution

- After substituting, **no $x$ may remain**, not even in $dx$.
- $\int f(ax + b)\,dx$: divide by $a$. So $\int e^{3x}\,dx = \tfrac13 e^{3x} + C$ and $\int \sin(2 - 5x)\,dx = \tfrac15\cos(2 - 5x) + C$.

:::tip
"Derivative on top": if the numerator is the derivative of the denominator, the answer is $\log|\text{denominator}|$. If the numerator is almost the derivative, fix the constant: $\int \dfrac{x}{x^2 + 1}\,dx = \tfrac12\log(x^2 + 1) + C$.
:::

:::trap
$\int \dfrac{dx}{x^2 + 1} = \tan^{-1}x$, but $\int \dfrac{x\,dx}{x^2 + 1} = \tfrac12\log(x^2 + 1)$, and $\int \dfrac{x\,dx}{x^4 + 1} = \tfrac12\tan^{-1}(x^2)$. Look at what the numerator is the derivative of.
:::

## Partial fractions

:::trap
Partial fractions work only on **proper** fractions. If the degree of the top is equal to or more than that of the bottom, divide first. $\dfrac{x^2}{(x - 1)(x - 2)}$ is $1 + \dfrac{3x - 2}{(x - 1)(x - 2)}$.
:::

:::trap
- A repeated factor $(x - a)^2$ needs **both** $\dfrac{A}{x - a}$ and $\dfrac{B}{(x - a)^2}$.
- A quadratic factor that cannot be factorised needs $\dfrac{Bx + C}{x^2 + bx + c}$, not just a constant on top.
:::

:::tip
Quick constants for distinct linear factors ("cover-up"): for $\dfrac{A}{x - a}$, cover the factor $(x - a)$ in the original (proper) fraction and put $x = a$ in what is left. A shortcut, not in NCERT (NCERT compares coefficients). It gives the same answer as putting $x = a$ after clearing denominators.
:::

## Integration by parts

:::tip
**ILATE** (a memory aid, not in NCERT) for the first function: **I**nverse trigonometric, **L**ogarithmic, **A**lgebraic, **T**rigonometric, **E**xponential. Take the one that comes first as the first function. This matches NCERT's rule: a polynomial is first, unless the other is an inverse trigonometric or log function.
:::

- A wrong choice of first function makes the new integral **harder** (higher power of $x$). Then swap.
- Single functions like $\log x$, $\tan^{-1} x$, $\sin^{-1} x$: take $1$ as the second function.
- When the same integral comes back (as with $e^x\sin x$), move it to the left side and solve. Do not go round a third time.

:::tip
Spot $e^x[f + f']$: pairs like $\tan^{-1}x$ and $\dfrac{1}{1 + x^2}$, $\log x$ and $\dfrac1x$, $\dfrac1x$ and $-\dfrac{1}{x^2}$, $\sin x$ and $\cos x$. The answer is $e^x f(x) + C$.
:::

## Definite integrals

:::remember
- $\int_a^b f(x)\,dx$ is a **number**. It does not depend on the letter used: $\int_a^b f(x)\,dx = \int_a^b f(t)\,dt$.
- Swapping the limits changes the sign. Equal limits give 0.
- The constant $C$ cancels in $F(b) - F(a)$, so it is never written.
:::

:::trap
The second fundamental theorem needs $f$ continuous on the **whole** of $[a, b]$. $\int_{-1}^{1} \dfrac{dx}{x^2}$ is not $\left[-\dfrac1x\right]_{-1}^{1} = -2$: the integrand blows up at $x = 0$. (A positive function cannot have a negative integral.)
:::

:::trap
In a substitution, **change the limits** too. If you keep the old limits, go back to $x$ before putting them in.
:::

:::trap
$\int_a^b f(x)\,dx$ is the **signed** area. Parts below the $x$-axis count as negative. With $|f(x)|$, split at the zeros of $f$ first (P2).
:::

## Using the properties

:::remember
- **P4** with $a = \frac{\pi}{2}$ swaps $\sin$ and $\cos$. Hence $\int_0^{\pi/2} \dfrac{f(\sin x)}{f(\sin x) + f(\cos x)}\,dx = \dfrac{\pi}{4}$, when the denominator is never 0 there.
- **P7:** odd function on $[-a, a]$ gives 0; even gives twice the integral over $[0, a]$.
- $\int_0^{\pi/2} \log\sin x\,dx = \int_0^{\pi/2} \log\cos x\,dx = -\dfrac{\pi}{2}\log 2$ (NCERT Example 34).
:::

:::trap
P7 needs **symmetric** limits $-a$ to $a$. On $[0, 2]$ an odd function need not give 0. Check oddness properly: $f(-x) = -f(x)$ for every $x$. $x^2\sin x$ is odd, $x\sin x$ is even, $e^x$ is neither.
:::

:::tip
King's trick (P3/P4): when $x$ multiplies a function of $\sin x$ on $[0, \pi]$, replace $x$ by $\pi - x$ and add. You get
$$\begin{aligned} &\int_0^{\pi} x\,f(\sin x)\,dx \\ &= \frac{\pi}{2}\int_0^{\pi} f(\sin x)\,dx \end{aligned}$$
:::

- (Exam extra) $\dfrac{d}{dx}\int_0^{x^2} f(t)\,dt = 2x\,f(x^2)$: do not forget to multiply by the derivative of the limit.
