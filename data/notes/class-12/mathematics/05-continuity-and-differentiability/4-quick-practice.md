---
title: "Continuity and Differentiability: Quick Practice"
type: practice
chapter: c12.mathematics.continuity-and-differentiability
order: 4
---

Try each question first, then tap **Show answer**. Here $\log$ means the natural logarithm.

## Continuity

:::question{title="1. Find k" exam="JEE Main level"}
$f(x) = \dfrac{1 - \cos 4x}{x^2}$ for $x \ne 0$, and $f(0) = k$. Find $k$ so that $f$ is continuous at $x = 0$.

---

$1 - \cos 4x = 2\sin^2 2x$, so $f(x) = 8\left(\dfrac{\sin 2x}{2x}\right)^2 \to 8$ as $x \to 0$.

So $k =$ **8**.
:::

:::question{title="2. Two joining points" exam="JEE Main level"}
$f(x) = 2x + a$ for $x < 1$, $f(x) = bx^2 + 1$ for $1 \le x < 2$, and $f(x) = 3x + 7$ for $x \ge 2$. If $f$ is continuous everywhere, find $a + b$.

---

At $x = 2$: $4b + 1 = 13$, so $b = 3$.

At $x = 1$: $2 + a = b + 1 = 4$, so $a = 2$.

$a + b =$ **5**.
:::

## Differentiability

:::question{title="3. Counting corners" exam="JEE Main level"}
At how many points is $f(x) = |x^2 - 3x + 2| + |x|$ not differentiable?

---

$x^2 - 3x + 2 = (x - 1)(x - 2)$ changes sign at $x = 1$ and $x = 2$ (simple roots), so its modulus has corners there. $|x|$ has a corner at $x = 0$.

At each of these points only one term has a corner, so nothing cancels. Answer: **3 points** ($x = 0, 1, 2$).
:::

:::question{title="4. Smooth join" exam="JEE Main level"}
$f(x) = x^2$ for $x \le 1$ and $f(x) = ax + b$ for $x > 1$. Find $a$ and $b$ so that $f$ is differentiable at $x = 1$.

---

Continuity at 1: $a + b = 1$.

Equal derivatives at 1: LHD $= 2x = 2$ and RHD $= a$, so $a = 2$.

**$a = 2$, $b = -1$.**
:::

## Derivatives

:::question{title="5. Substitution" exam="JEE Main level"}
Find $\dfrac{dy}{dx}$ if $y = \tan^{-1}\dfrac{\sqrt{1 + x^2} - 1}{x}$, $x \ne 0$.

---

Put $x = \tan\theta$ with $\theta \in \left(-\frac{\pi}{2}, \frac{\pi}{2}\right)$, $\theta \ne 0$:
$\dfrac{\sec\theta - 1}{\tan\theta} = \dfrac{1 - \cos\theta}{\sin\theta} = \tan\dfrac{\theta}{2}$.

As $\dfrac{\theta}{2} \in \left(-\frac{\pi}{4}, \frac{\pi}{4}\right)$, $y = \dfrac{\theta}{2} = \dfrac12\tan^{-1}x$.

$\dfrac{dy}{dx} =$ **$\dfrac{1}{2(1 + x^2)}$**.
:::

:::question{title="6. Implicit slope" exam="JEE Main level"}
For the curve $x^3 + y^3 = 3xy$, find $\dfrac{dy}{dx}$ at the point $\left(\frac32, \frac32\right)$.

---

$3x^2 + 3y^2 y' = 3y + 3x y'$, so $y' = \dfrac{y - x^2}{y^2 - x}$.

At $\left(\frac32, \frac32\right)$: $y' = \dfrac{\frac32 - \frac94}{\frac94 - \frac32} = \dfrac{-\frac34}{\frac34} =$ **−1**.
:::

:::question{title="7. Variable power" exam="JEE Main level"}
If $y = x^{\sin x}$ ($x > 0$), find $\dfrac{dy}{dx}$ at $x = \dfrac{\pi}{2}$.

---

$\log y = \sin x \log x$, so $\dfrac{dy}{dx} = x^{\sin x}\left(\cos x \log x + \dfrac{\sin x}{x}\right)$.

At $x = \dfrac{\pi}{2}$: $\sin x = 1$, $\cos x = 0$, so $\dfrac{dy}{dx} = \dfrac{\pi}{2}\left(0 + \dfrac{2}{\pi}\right) =$ **1**.
:::

:::question{title="8. One function w.r.t. another" exam="JEE Main level"}
Find the derivative of $\sin^{-1}\dfrac{2x}{1 + x^2}$ with respect to $\tan^{-1}x$, for $-1 < x < 1$.

---

For $|x| < 1$, $\sin^{-1}\dfrac{2x}{1 + x^2} = 2\tan^{-1}x$. So $u = 2v$, where $v = \tan^{-1}x$.

$\dfrac{du}{dv} =$ **2**.
:::

## Parametric and second derivatives

:::question{title="9. Ellipse" exam="JEE Main level"}
If $x = 2\cos t$ and $y = 3\sin t$, find $\dfrac{d^2y}{dx^2}$ at $t = \dfrac{\pi}{4}$.

---

$\dfrac{dy}{dx} = \dfrac{3\cos t}{-2\sin t} = -\dfrac32\cot t$.

$\dfrac{d^2y}{dx^2} = \dfrac{\frac32\operatorname{cosec}^2 t}{-2\sin t} = -\dfrac34\operatorname{cosec}^3 t$.

At $t = \dfrac{\pi}{4}$, $\operatorname{cosec} t = \sqrt2$, so $\operatorname{cosec}^3 t = 2\sqrt2$. Answer: **$-\dfrac{3\sqrt2}{2}$**.
:::

:::question{title="10. A relation" exam="JEE Main level"}
If $y = \left(\sin^{-1}x\right)^2$ for $-1 < x < 1$, find the value of $(1 - x^2)\,y_2 - x\,y_1$.

---

$y_1 = \dfrac{2\sin^{-1}x}{\sqrt{1 - x^2}}$, so $\sqrt{1 - x^2}\,y_1 = 2\sin^{-1}x$.

Differentiate: $\sqrt{1 - x^2}\,y_2 - \dfrac{x\,y_1}{\sqrt{1 - x^2}} = \dfrac{2}{\sqrt{1 - x^2}}$.

Multiply by $\sqrt{1 - x^2}$: $(1 - x^2)\,y_2 - x\,y_1 =$ **2**.
:::
