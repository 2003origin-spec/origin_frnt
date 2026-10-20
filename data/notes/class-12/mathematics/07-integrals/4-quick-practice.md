---
title: "Integrals: Quick Practice"
type: practice
chapter: c12.mathematics.integrals
order: 4
---

Try each question first, then tap **Show answer**. $\log$ means the natural logarithm.

## Substitution and standard forms

:::question{title="1. Substitution" exam="JEE Main level"}
Find $\displaystyle\int \frac{\sec^2 x}{\tan^2 x + 4}\,dx$.

---

Put $t = \tan x$, $dt = \sec^2 x\,dx$: $\displaystyle\int \frac{dt}{t^2 + 2^2} = \frac12\tan^{-1}\frac{t}{2} + C$.

Answer: **$\dfrac12\tan^{-1}\left(\dfrac{\tan x}{2}\right) + C$**.
:::

:::question{title="2. Completing the square" exam="JEE Main level"}
Find $\displaystyle\int \frac{dx}{\sqrt{8 - 2x - x^2}}$.

---

$8 - 2x - x^2 = 9 - (x^2 + 2x + 1) = 3^2 - (x + 1)^2$.

Put $t = x + 1$: $\displaystyle\int \frac{dt}{\sqrt{3^2 - t^2}} = \sin^{-1}\frac{t}{3} + C$. Answer: **$\sin^{-1}\dfrac{x + 1}{3} + C$**.
:::

:::question{title="3. Linear over quadratic" exam="JEE Main level"}
Find $\displaystyle\int \frac{2x + 5}{x^2 + 2x + 5}\,dx$.

---

Write $2x + 5 = A(2x + 2) + B$. Then $2A = 2$ and $2A + B = 5$, so $A = 1$, $B = 3$.

The first part is $\log(x^2 + 2x + 5)$ (no modulus needed: $x^2 + 2x + 5 > 0$). The second part is $\displaystyle 3\int \frac{dx}{(x + 1)^2 + 2^2} = \frac32\tan^{-1}\frac{x + 1}{2}$.

Answer: **$\log(x^2 + 2x + 5) + \dfrac32\tan^{-1}\dfrac{x + 1}{2} + C$**.
:::

## Partial fractions and parts

:::question{title="4. Repeated factor" exam="JEE Main level"}
Find $\displaystyle\int \frac{x}{(x - 1)^2(x + 2)}\,dx$.

---

Write $\dfrac{x}{(x - 1)^2(x + 2)} = \dfrac{A}{x - 1} + \dfrac{B}{(x - 1)^2} + \dfrac{C}{x + 2}$, so $x = A(x - 1)(x + 2) + B(x + 2) + C(x - 1)^2$.

$x = 1$: $1 = 3B$, so $B = \frac13$. $x = -2$: $-2 = 9C$, so $C = -\frac29$. Coefficient of $x^2$: $A + C = 0$, so $A = \frac29$.

Answer: **$\dfrac29\log\left|\dfrac{x - 1}{x + 2}\right| - \dfrac{1}{3(x - 1)} + C$**.
:::

:::question{title="5. By parts" exam="JEE Main level"}
Find $\displaystyle\int x\tan^{-1}x\,dx$.

---

First function $\tan^{-1}x$, second $x$:
$\displaystyle\frac{x^2}{2}\tan^{-1}x - \int \frac{x^2}{2(1 + x^2)}\,dx$.

Since $\dfrac{x^2}{1 + x^2} = 1 - \dfrac{1}{1 + x^2}$, the last integral is $\frac12(x - \tan^{-1}x)$.

Answer: **$\dfrac{x^2 + 1}{2}\tan^{-1}x - \dfrac{x}{2} + C$**.
:::

:::question{title="6. The e^x [f + f′] type" exam="JEE Main level"}
Find $\displaystyle\int e^x\,\frac{x\log x + 1}{x}\,dx$ for $x > 0$.

---

$\dfrac{x\log x + 1}{x} = \log x + \dfrac1x$. With $f(x) = \log x$, $f'(x) = \dfrac1x$, so this is $e^x[f + f']$.

Answer: **$e^x\log x + C$**.
:::

## Definite integrals

:::question{title="7. Change the limits" exam="JEE Main level"}
Evaluate $\displaystyle\int_0^{\pi/2} \sin^3 x\cos^2 x\,dx$.

---

Write $\sin^3 x\cos^2 x = (1 - \cos^2 x)\cos^2 x\sin x$ and put $t = \cos x$, $dt = -\sin x\,dx$. At $x = 0$, $t = 1$; at $x = \frac{\pi}{2}$, $t = 0$.

$\displaystyle\int_1^0 -(1 - t^2)\,t^2\,dt = \int_0^1 (t^2 - t^4)\,dt = \frac13 - \frac15 =$ **$\dfrac{2}{15}$**.
:::

:::question{title="8. Modulus" exam="JEE Main level"}
Evaluate $\displaystyle\int_0^2 |x^2 - 1|\,dx$.

---

$x^2 - 1 < 0$ on $(0, 1)$ and $> 0$ on $(1, 2)$. Split at 1 (P2):

$\displaystyle\int_0^1 (1 - x^2)\,dx = \frac23$ and $\displaystyle\int_1^2 (x^2 - 1)\,dx = \left(\frac83 - 2\right) - \left(\frac13 - 1\right) = \frac43$.

Total: **2**.
:::

## Properties

:::question{title="9. Odd and even" exam="JEE Main level"}
Evaluate $\displaystyle\int_{-2}^{2} \left(x^3\cos x + |x|\right)dx$.

---

$x^3\cos x$ is odd, so its integral over $[-2, 2]$ is 0 (P7). $|x|$ is even, so its integral is $\displaystyle 2\int_0^2 x\,dx = 4$.

Answer: **4**.
:::

:::question{title="10. King's property" exam="JEE Main level"}
Evaluate $\displaystyle\int_0^{\pi} \frac{x}{1 + \sin x}\,dx$.

---

Let $I$ be the integral. By P4, with $\sin(\pi - x) = \sin x$: $\displaystyle I = \int_0^{\pi} \frac{\pi - x}{1 + \sin x}\,dx$. Adding the two forms, $\displaystyle 2I = \pi\int_0^{\pi} \frac{dx}{1 + \sin x}$.

By P6 and then P4 on $[0, \frac{\pi}{2}]$, using $1 + \cos x = 2\cos^2\frac{x}{2}$:
$$\begin{aligned} &\int_0^{\pi} \frac{dx}{1 + \sin x} \\ &= 2\int_0^{\pi/2} \frac{dx}{1 + \cos x} \\ &= \int_0^{\pi/2} \sec^2\frac{x}{2}\,dx \\ &= 2\left[\tan\frac{x}{2}\right]_0^{\pi/2} = 2 \end{aligned}$$

So $2I = 2\pi$ and $I =$ **$\pi$**.
:::
