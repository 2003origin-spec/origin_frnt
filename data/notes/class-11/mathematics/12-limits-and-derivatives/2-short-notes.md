---
title: "Limits and Derivatives: Short Notes"
type: short_notes
chapter: c11.mathematics.limits-and-derivatives
order: 2
---

## 1. The idea of a derivative

- NCERT starts with a body falling from a cliff: it covers $s = 4.9t^2$ metres in $t$ seconds.
- The **average velocity** over $[t_1, t_2]$ is $\dfrac{s(t_2) - s(t_1)}{t_2 - t_1}$.
- Take smaller and smaller intervals ending at $t = 2$, and starting at $t = 2$. Both lists of average velocities close in on one value. That value is the **instantaneous velocity** at $t = 2$. NCERT only traps it between $19.551$ and $19.649$ m/s; the exact value is $19.6$ m/s.
- On the $s$–$t$ graph, each average velocity is the slope of a chord. In the limit the chord becomes the **tangent**. So the instantaneous rate of change is the slope of the tangent.

## 2. Limits

- $\lim_{x \to a} f(x) = l$ means: as $x$ gets close to $a$ (but $x \ne a$), $f(x)$ gets close to $l$.
- $x$ can come towards $a$ from two sides:
  - from the left ($x < a$): the **left hand limit**, $\lim_{x \to a^-} f(x)$;
  - from the right ($x > a$): the **right hand limit**, $\lim_{x \to a^+} f(x)$.
- The limit exists only when both one-sided limits exist and are equal.
- The limit and the value $f(a)$ are different things. One can exist without the other, and both can exist but differ.

| Function, point | Limit | Value |
|---|---|---|
| $\lvert x\rvert$, $x \ne 0$, at 0 | 0 | not defined |
| $1$ for $x \le 0$, $2$ for $x > 0$, at 0 | does not exist | $1$ |
| $x + 2$ for $x \ne 1$, $0$ at $x = 1$, at 1 | 3 | 0 |

- If $f(x)$ grows without bound (as $\dfrac{1}{x^2}$ does when $x \to 0$), NCERT writes $+\infty$, but this is **not** a real-number limit. NCERT does not use such limits in this course.

## 3. Algebra of limits

- When $\lim f$ and $\lim g$ both exist, limits pass through $+$, $-$, $\times$ and $\div$. For $\div$ the limit of the denominator must not be 0.
- Special case: $\lim\, \lambda f(x) = \lambda \lim f(x)$ for a constant $\lambda$.
- **Polynomials:** $\lim_{x \to a} p(x) = p(a)$. Just substitute.
- **Rational functions** $\dfrac{g(x)}{h(x)}$:
  - $h(a) \ne 0$: substitute;
  - $h(a) = 0$, $g(a) \ne 0$: the limit does not exist;
  - both 0: factor out $(x - a)$ from top and bottom, cancel (allowed because $x \ne a$), then substitute. Repeat if it is still $\frac00$.

:::example{title="The 0/0 form"}
$\displaystyle\lim_{x \to 2} \frac{x^2 - 4}{x - 2} = \lim_{x \to 2} (x + 2) = 4$
:::

- NCERT's general rule for $\dfrac{f(x)}{g(x)}$ with $f(a) = g(a) = 0$: find the factor that makes both vanish, cancel it, then substitute.

## 4. The power limit

For any positive integer $n$:

$$\lim_{x \to a} \frac{x^n - a^n}{x - a} = n a^{n-1}$$

- Proof idea: $x^n - a^n = (x - a)(x^{n-1} + x^{n-2}a + \cdots + a^{n-1})$. The bracket has $n$ terms, each tending to $a^{n-1}$.
- NCERT remarks that it also holds for any rational $n$ when $a > 0$.
- To use it, make the expression look like $\dfrac{x^n - a^n}{x - a}$. Divide top and bottom by $(x - a)$ if needed, or substitute (for example $y = 1 + x$ turns $x \to 0$ into $y \to 1$).

:::example{title="Ratio of two power limits"}
$\displaystyle\lim_{x \to 1} \frac{x^{15} - 1}{x^{10} - 1} = \frac{15 \cdot 1^{14}}{10 \cdot 1^{9}} = \frac32$
:::

:::tip
For square roots, **rationalise**: multiply top and bottom by the conjugate. For example,
$\dfrac{\sqrt{1+x} - 1}{x} = \dfrac{1}{\sqrt{1+x} + 1} \to \dfrac12$.
:::

## 5. Limits of trigonometric functions

- **Comparison:** if $f(x) \le g(x)$ and both limits at $a$ exist, then $\lim f \le \lim g$.
- **Sandwich theorem:** if $f(x) \le g(x) \le h(x)$ and $f$, $h$ have the same limit $l$ at $a$, then $g$ also has limit $l$.
- NCERT proves $\sin x < x < \tan x$ for $0 < x < \dfrac{\pi}{2}$ by comparing areas in the unit circle: triangle $OAC$ < sector $OAC$ < triangle $OAB$.
- Dividing by $\sin x$ and taking reciprocals gives $\cos x < \dfrac{\sin x}{x} < 1$. Since $\cos x \to 1$, the sandwich theorem gives $\lim_{x \to 0} \dfrac{\sin x}{x} = 1$.
- Using $1 - \cos x = 2\sin^2 \dfrac{x}{2}$:

$$\frac{1 - \cos x}{x} = \frac{\sin (x/2)}{x/2} \cdot \sin \frac{x}{2}$$

This tends to $1 \cdot 0 = 0$.

:::example{title="Making the angles match"}
$\displaystyle\frac{\sin 4x}{\sin 2x} = 2 \cdot \frac{\sin 4x}{4x} \cdot \frac{2x}{\sin 2x} \to 2 \cdot 1 \cdot 1 = 2$
:::

## 6. Derivative at a point

The **derivative of $f$ at $a$** is

$$f'(a) = \lim_{h \to 0} \frac{f(a + h) - f(a)}{h}$$

provided the limit exists.

- **Meaning:** the rate of change of $f(x)$ at $x = a$.
- **Geometry:** take $P = (a, f(a))$ and $Q = (a + h, f(a + h))$ on the curve. The ratio is the slope of chord $PQ$. As $h \to 0$, $Q \to P$ and the chord becomes the tangent at $P$. So $f'(a) = \tan\psi$, the slope of the tangent ($\psi$ = the angle the tangent makes with the positive $x$-axis).

:::example{title="At a point"}
$f(x) = 3x$: $\quad f'(2) = \displaystyle\lim_{h \to 0} \frac{3(2 + h) - 6}{h} = \lim_{h \to 0} 3 = 3$
:::

## 7. Derivative as a function (first principle)

- $f'(x) = \displaystyle\lim_{h \to 0} \frac{f(x + h) - f(x)}{h}$, wherever this limit exists. This is the **first principle**.
- Notation: $f'(x)$, $\dfrac{d}{dx}f(x)$, $\dfrac{dy}{dx}$ (for $y = f(x)$), $D(f(x))$. At $x = a$: $f'(a)$ or $\left.\dfrac{df}{dx}\right|_{x=a}$.
- **Steps:** write $f(x + h) - f(x)$, simplify until a factor $h$ comes out, cancel $h$, then put $h = 0$.

| $f(x)$ | First-principle result |
|---|---|
| $a$ (constant) | $0$ |
| $10x$ | $10$ |
| $x^2$ | $2x$ |
| $\dfrac1x$ | $-\dfrac{1}{x^2}$ |
| $\sin x$ | $\cos x$ |
| $\tan x$ | $\sec^2 x$ |

- For $\sin x$, NCERT uses $\sin A - \sin B = 2\cos\dfrac{A+B}{2}\sin\dfrac{A-B}{2}$. For $\tan x$, it uses $\sin(A - B)$ after taking a common denominator.

## 8. Algebra of derivatives

- Sum and difference: $(u \pm v)' = u' \pm v'$.
- **Product (Leibnitz) rule:** $(uv)' = u'v + uv'$.
- **Quotient rule:** $\left(\dfrac{u}{v}\right)' = \dfrac{u'v - uv'}{v^2}$, where $v \ne 0$.
- Constant multiple: $(\lambda u)' = \lambda u'$ (product rule with $\lambda' = 0$).

## 9. Standard derivatives

- $\dfrac{d}{dx}(x^n) = nx^{n-1}$. NCERT proves it for positive integers $n$ (by the binomial theorem, or by induction with the product rule) and states it for all real $n$.
- Polynomial: differentiate term by term. $\dfrac{d}{dx}(6x^{100} - x^{55} + x) = 600x^{99} - 55x^{54} + 1$.
- $\sin x \to \cos x$, $\cos x \to -\sin x$, $\tan x \to \sec^2 x$.
- From the quotient rule: $\cot x \to -\operatorname{cosec}^2 x$, $\sec x \to \sec x\tan x$, $\operatorname{cosec} x \to -\operatorname{cosec} x\cot x$.

:::example{title="Product rule"}
$\dfrac{d}{dx}(\sin^2 x) = \cos x\sin x + \sin x\cos x = \sin 2x$
:::

:::example{title="Quotient rule"}
$\dfrac{d}{dx}\left(\dfrac{x + 1}{x}\right) = \dfrac{1 \cdot x - (x + 1) \cdot 1}{x^2} = -\dfrac{1}{x^2}$, for $x \ne 0$.
:::

## 10. Beyond this chapter

Exam extras (in the JEE Main syllabus, not in NCERT):

- **Limits at infinity:** divide top and bottom by the highest power of $x$ in the denominator. Then use $\dfrac{1}{x^k} \to 0$ as $x \to \infty$ (for $k > 0$).
- **Exponential and log limits:** $\dfrac{e^x - 1}{x} \to 1$, $\dfrac{\log_e(1+x)}{x} \to 1$ as $x \to 0$. JEE Main uses them often.

Taught later in NCERT:

- **Chain rule** (NCERT Class 12, Continuity and Differentiability): $\dfrac{d}{dx}f(g(x)) = f'(g(x))\,g'(x)$. For example, $\dfrac{d}{dx}\sin 2x = 2\cos 2x$. In this chapter, NCERT gets $\sin 2x$ by writing it as $2\sin x\cos x$.

Beyond the syllabus (not in NCERT or the JEE Main syllabus; only a checking aid):

- **L'Hospital's rule:** for a $\frac00$ or $\frac{\infty}{\infty}$ form, $\lim \dfrac{f}{g} = \lim \dfrac{f'}{g'}$ if the second limit exists. Use it only on these forms.
