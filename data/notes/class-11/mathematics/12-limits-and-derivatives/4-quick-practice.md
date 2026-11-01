---
title: "Limits and Derivatives: Quick Practice"
type: practice
chapter: c11.mathematics.limits-and-derivatives
order: 4
---

Try each question first, then tap **Show answer**. All angles are in radians.

## Algebraic limits

:::question{title="1. Power limit" exam="JEE Main level"}
Evaluate $\displaystyle\lim_{x \to 2} \frac{x^5 - 32}{x^3 - 8}$.

---

Divide top and bottom by $(x - 2)$. Each part is then a power limit $\dfrac{x^n - a^n}{x - a} \to na^{n-1}$ with $a = 2$:

$\dfrac{5 \cdot 2^4}{3 \cdot 2^2} = \dfrac{80}{12} =$ **$\dfrac{20}{3}$**.
:::

:::question{title="2. Rationalise" exam="JEE Main level"}
Evaluate $\displaystyle\lim_{x \to 0} \frac{\sqrt{1 + x} - \sqrt{1 - x}}{x}$.

---

Multiply top and bottom by $\sqrt{1 + x} + \sqrt{1 - x}$. The top becomes $(1 + x) - (1 - x) = 2x$.

So the expression is $\dfrac{2}{\sqrt{1 + x} + \sqrt{1 - x}} \to \dfrac{2}{2} =$ **1**.
:::

## One-sided limits

:::question{title="3. Find the constants" exam="JEE Main level"}
$f(x) = ax + 3$ for $x < 2$, $f(2) = 7$, and $f(x) = x^2 - b$ for $x > 2$. If $\lim_{x \to 2} f(x) = f(2)$, find $a$ and $b$.

---

LHL $= 2a + 3 = 7$, so $a = 2$.

RHL $= 4 - b = 7$, so $b = -3$.

**$a = 2$, $b = -3$.**
:::

:::question{title="4. Modulus in the denominator" exam="JEE Main level"}
Does $\displaystyle\lim_{x \to 3} \frac{x^2 - 9}{\lvert x - 3\rvert}$ exist?

---

For $x > 3$: $\lvert x - 3\rvert = x - 3$, so $f(x) = x + 3 \to 6$.

For $x < 3$: $\lvert x - 3\rvert = -(x - 3)$, so $f(x) = -(x + 3) \to -6$.

RHL $= 6$ and LHL $= -6$ differ, so the limit **does not exist**.
:::

## Trigonometric limits

:::question{title="5. Cosine over a square" exam="JEE Main level"}
Evaluate $\displaystyle\lim_{x \to 0} \frac{1 - \cos 4x}{x^2}$.

---

$1 - \cos 4x = 2\sin^2 2x$. So the expression is

$2\left(\dfrac{\sin 2x}{x}\right)^2 = 2\left(2 \cdot \dfrac{\sin 2x}{2x}\right)^2 \to 2 \times 4 =$ **8**.
:::

:::question{title="6. Shift the point" exam="JEE Main level"}
Evaluate $\displaystyle\lim_{x \to \pi/2} \frac{1 - \sin x}{\left(\frac{\pi}{2} - x\right)^2}$.

---

Put $y = \dfrac{\pi}{2} - x$, so $y \to 0$ and $\sin x = \cos y$. The limit becomes $\dfrac{1 - \cos y}{y^2} = \dfrac{2\sin^2 (y/2)}{y^2}$.

That is $\dfrac12\left(\dfrac{\sin (y/2)}{y/2}\right)^2 \to$ **$\dfrac12$**.
:::

## Derivatives

:::question{title="7. First principle" exam="JEE Main level"}
Using the first principle, find the derivative of $f(x) = \sqrt{x}$ for $x > 0$.

---

$\dfrac{\sqrt{x + h} - \sqrt{x}}{h} = \dfrac{(x + h) - x}{h\left(\sqrt{x + h} + \sqrt{x}\right)} = \dfrac{1}{\sqrt{x + h} + \sqrt{x}}$

As $h \to 0$: $f'(x) =$ **$\dfrac{1}{2\sqrt{x}}$**.
:::

:::question{title="8. Product rule" exam="JEE Main level"}
If $f(x) = x\sin x + \cos x$, find $f'(\pi)$.

---

$f'(x) = (\sin x + x\cos x) - \sin x = x\cos x$.

$f'(\pi) = \pi\cos\pi =$ **$-\pi$**.
:::

:::question{title="9. Quotient rule" exam="JEE Main level"}
If $f(x) = \dfrac{x^2 + 1}{x - 1}$, find $f'(2)$.

---

$f'(x) = \dfrac{2x(x - 1) - (x^2 + 1)}{(x - 1)^2} = \dfrac{x^2 - 2x - 1}{(x - 1)^2}$.

$f'(2) = \dfrac{4 - 4 - 1}{1} =$ **$-1$**.
:::

:::question{title="10. Unknown coefficients" exam="JEE Main level"}
$f(x) = x^3 + ax^2 + bx$. If $f'(1) = 0$ and $f'(-1) = 4$, find $a$ and $b$.

---

$f'(x) = 3x^2 + 2ax + b$.

$f'(1) = 3 + 2a + b = 0$ and $f'(-1) = 3 - 2a + b = 4$.

Subtracting: $4a = -4$, so $a = -1$. Then $b = -3 - 2a = -1$.

**$a = -1$, $b = -1$.**
:::
