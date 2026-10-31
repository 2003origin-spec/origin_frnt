---
title: "Limits and Derivatives: Important Points and Traps"
type: key_points
chapter: c11.mathematics.limits-and-derivatives
order: 3
---

## Limits: what they mean

:::remember
- The limit at $a$ depends only on values of $f$ **near** $a$, never on $f(a)$ itself.
- $\lim_{x \to a} f(x)$ exists only when LHL = RHL (both finite).
- A function can be defined at $a$ and still have no limit there (NCERT: $f = 1$ for $x \le 0$, $f = 2$ for $x > 0$).
- A function can have a limit at $a$ that differs from $f(a)$ (NCERT: $x + 2$ for $x \ne 1$, with $f(1) = 0$; the limit is 3).
:::

:::trap
**Modulus and greatest integer: always check both sides.**
- $\dfrac{\lvert x\rvert}{x}$ at 0: LHL $= -1$, RHL $= 1$. No limit (NCERT exercise).
- The two $[x]$ lines below are not in this chapter. $[x]$ is defined in NCERT Class 11 Chapter 2, and its jumps at integers are in NCERT Class 12 (Continuity).
- $[x]$ at an integer $n$: LHL $= n - 1$, RHL $= n$. No limit.
- $[x]$ at a non-integer $a$: the limit is $[a]$.
:::

- For a **piecewise** function, the joining points are where LHL and RHL can differ, so check both sides there. Use the left formula for LHL and the right formula for RHL. The formula given *at* the point itself is not used for the limit.
- When a question says "the limit equals $f(a)$", set LHL = RHL = $f(a)$ and solve.

## Algebra of limits

:::trap
The sum, product and quotient rules need **both** limits to exist first. The reverse is false: $\lim (f + g)$ can exist when neither $\lim f$ nor $\lim g$ does. Example: $f = \dfrac1x$, $g = -\dfrac1x$ at 0.
:::

:::trap
**Non-zero over zero:** if the top tends to a non-zero number and the bottom to 0, the limit does **not** exist (as a real number). Do not answer 0 or "infinity".
:::

- In the $\frac00$ form, cancelling $(x - a)$ is allowed because $x \ne a$ while taking a limit.
- NCERT result for $\dfrac{g(x)}{h(x)}$ with $g = (x - a)^k g_1$, $h = (x - a)^l h_1$ (and $g_1(a), h_1(a) \ne 0$): the limit is 0 if $k > l$, and is not defined if $k < l$. If $k = l$, cancel and get $\dfrac{g_1(a)}{h_1(a)}$.

:::tip
**Power limit pattern:** $\dfrac{x^m - a^m}{x^n - a^n} \to \dfrac{m}{n}\,a^{m-n}$ as $x \to a$, for positive integers $m, n$ and $a \ne 0$. Divide top and bottom by $(x - a)$ and use the power limit twice.
:::

## Trigonometric limits

:::trap
**Radians only.** $\lim_{x \to 0} \dfrac{\sin x}{x} = 1$ is true only for $x$ in radians. If $x$ is in degrees, $\dfrac{\sin x^\circ}{x} \to \dfrac{\pi}{180}$.
:::

:::trap
$\dfrac{\sin x}{x} \to 1$ only as $x \to 0$. As $x \to \infty$ it tends to **0** (exam extra), since $\lvert \sin x\rvert \le 1$. As $x \to \pi$, $\dfrac{\sin x}{x} \to 0$, just by substituting.
:::

- The angle and the denominator must match: $\dfrac{\sin 5x}{x} = 5 \cdot \dfrac{\sin 5x}{5x} \to 5$.
- When $x \to a$ with $a \ne 0$, shift first: put $y = x - a$ (or $y = a - x$), so that $y \to 0$.
- $1 - \cos x = 2\sin^2\dfrac{x}{2}$ turns cosine limits into sine limits.

:::remember
- $\lim_{x \to 0} \dfrac{\sin x}{x} = 1$, $\lim_{x \to 0} \dfrac{\tan x}{x} = 1$, $\lim_{x \to 0} \dfrac{1 - \cos x}{x} = 0$.
- (Exam extra) $\lim_{x \to 0} \dfrac{1 - \cos x}{x^2} = \dfrac12$. Do not mix it up with the one above.
- $\sin x < x < \tan x$ for $0 < x < \dfrac{\pi}{2}$.
:::

## Derivatives

:::trap
**$f'(a)$ is not the derivative of $f(a)$.** $f(a)$ is a number, so its derivative is 0. Find $f'(x)$ first, then put $x = a$.
:::

:::trap
**Product rule:** $(uv)' = u'v + uv'$, **not** $u'v'$. Check with $x \cdot x$: the product rule gives $2x$; $u'v'$ would give 1.
:::

:::trap
**Quotient rule order:** the numerator is $u'v - uv'$ (derivative of the top first). Swapping the order flips the sign. Also, the denominator is $v^2$, not $v$.
:::

- A constant like $\pi^2$, $e$, $\sin\dfrac{\pi}{4}$ or $a^n$ has derivative 0. In $\dfrac{d}{dx}(x^n + a^n)$, only $x^n$ changes.
- $\dfrac{d}{dx}\left(\dfrac{1}{x^n}\right) = -\dfrac{n}{x^{n+1}}$. Write it as $x^{-n}$ first.
- Write roots as powers before differentiating: $\sqrt x = x^{1/2}$.
- The derivative may fail to exist where the function exists (NCERT Class 12, Continuity and Differentiability). For $f(x) = \lvert x\rvert$ at 0, the difference quotient $\dfrac{\lvert h\rvert}{h}$ gives $-1$ from the left and $1$ from the right, so $f'(0)$ does not exist.
- Where $f$ is not defined, $f'$ is not defined either (NCERT: $\dfrac{2x + 3}{x - 2}$ and its derivative, at $x = 2$).

:::remember
- $f'(a)$ = slope of the tangent at $(a, f(a))$.
- First principle: $f'(x) = \lim_{h \to 0} \dfrac{f(x + h) - f(x)}{h}$.
- NCERT: $\dfrac{d}{dx}(1 + x + x^2 + \cdots + x^{50})$ at $x = 1$ is $1 + 2 + \cdots + 50 = 1275$.
:::

:::tip
**Co-functions take the minus sign.** The derivatives of $\cos$, $\cot$ and $\operatorname{cosec}$ all start with "$-$". Each is the partner of $\sin$, $\tan$ or $\sec$:
- $\sin \to \cos$, so $\cos \to -\sin$;
- $\tan \to \sec^2$, so $\cot \to -\operatorname{cosec}^2$;
- $\sec \to \sec\tan$, so $\operatorname{cosec} \to -\operatorname{cosec}\cot$.
:::

:::tip
**Simplify before you differentiate.** $\dfrac{x^2 - 1}{x - 1} = x + 1$ for $x \ne 1$, so its derivative is 1 for every $x \ne 1$. $\sin x\cos x = \dfrac12\sin 2x$. Fewer quotient rules means fewer sign slips.
:::

## Beyond this chapter

- **Limits at infinity** (exam extra: in the JEE Main syllabus, not in NCERT): for a rational function, compare the highest powers. Same degree: the ratio of the leading coefficients.
- **L'Hospital's rule** (beyond the syllabus: not in NCERT or the JEE Main syllabus) needs a $\frac00$ or $\frac{\infty}{\infty}$ form. Using it on anything else gives wrong answers. Factorising or standard limits are often faster.
- **Chain rule** (NCERT Class 12, Continuity and Differentiability): $\dfrac{d}{dx}\sin(ax + b) = a\cos(ax + b)$. Do not forget the inner derivative $a$.
