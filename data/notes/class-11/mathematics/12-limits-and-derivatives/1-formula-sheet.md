---
title: "Limits and Derivatives: Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.limits-and-derivatives
order: 1
---

All angles are in **radians**. The trigonometric limits and derivatives below assume radians; most of them change in degrees (for example $\dfrac{\sin x}{x} \to \dfrac{\pi}{180}$ when $x$ is in degrees).

## Limits

:::formula{title="Left and right hand limits"}
$$\lim_{x \to a^-} f(x) = \text{LHL}$$
$$\lim_{x \to a^+} f(x) = \text{RHL}$$
LHL uses values of $x$ just less than $a$; RHL uses values just greater than $a$.

$\lim_{x \to a} f(x)$ exists only when LHL and RHL both exist and are **equal**. The limit is that common value. It does not depend on $f(a)$, and $f(a)$ need not even be defined.
:::

:::formula{title="Algebra of limits"}
If $\lim_{x \to a} f(x)$ and $\lim_{x \to a} g(x)$ both exist:
$$\lim (f \pm g) = \lim f \pm \lim g$$
$$\lim (f \cdot g) = \lim f \cdot \lim g$$
$$\lim \frac{f}{g} = \frac{\lim f}{\lim g}$$
$$\lim\, (\lambda f) = \lambda \lim f$$
The quotient rule needs $\lim g \ne 0$. $\lambda$ is any real constant.
:::

:::formula{title="Polynomials"}
$$\lim_{x \to a} p(x) = p(a)$$
For any polynomial $p$. Just substitute.
:::

:::formula{title="Rational functions"}
For polynomials $g$ and $h$ with $h(a) \ne 0$:
$$\lim_{x \to a} \frac{g(x)}{h(x)} = \frac{g(a)}{h(a)}$$
If $h(a) = 0$ and $g(a) \ne 0$, the limit does not exist. If both are 0 (the form $\frac00$), cancel the common factor $(x - a)$, then substitute. If it is still $\frac00$, cancel again.
:::

:::formula{title="Standard limit for powers"}
$$\lim_{x \to a} \frac{x^n - a^n}{x - a} = n\,a^{n-1}$$
Proved in NCERT for any positive integer $n$. Also true for any rational $n$ when $a > 0$.
:::

## Trigonometric limits

:::formula{title="The key inequality"}
$$\cos x < \frac{\sin x}{x} < 1$$
For $0 < |x| < \dfrac{\pi}{2}$. It comes from $\sin x < x < \tan x$ for $0 < x < \dfrac{\pi}{2}$.
:::

:::formula{title="Sandwich theorem"}
If $f(x) \le g(x) \le h(x)$ near $a$ and
$$\lim_{x \to a} f(x) = l = \lim_{x \to a} h(x)$$
then $\lim_{x \to a} g(x) = l$.
:::

:::formula{title="Two important limits"}
$$\lim_{x \to 0} \frac{\sin x}{x} = 1$$
$$\lim_{x \to 0} \frac{1 - \cos x}{x} = 0$$
:::

:::formula{title="Tangent limit"}
$$\lim_{x \to 0} \frac{\tan x}{x} = 1$$
Worked in NCERT as $\dfrac{\sin x}{x} \cdot \dfrac{1}{\cos x}$.
:::

:::formula{title="Scaled angle"}
$$\lim_{x \to 0} \frac{\sin kx}{kx} = 1$$
For a constant $k \ne 0$, because $kx \to 0$ when $x \to 0$. So
$$\lim_{x \to 0} \frac{\sin ax}{\sin bx} = \frac{a}{b}$$
for $a, b \ne 0$.
:::

## Derivatives

:::formula{title="Derivative at a point"}
$$f'(a) = \lim_{h \to 0} \frac{f(a + h) - f(a)}{h}$$
Only if this limit exists. $f'(a)$ is the **slope of the tangent** to $y = f(x)$ at $(a, f(a))$: $f'(a) = \tan\psi$, where $\psi$ is the angle the tangent makes with the positive $x$-axis.
:::

:::formula{title="First principle"}
$$f'(x) = \lim_{h \to 0} \frac{f(x + h) - f(x)}{h}$$
Defined wherever the limit exists. Other names: $\dfrac{dy}{dx}$, $\dfrac{d}{dx}f(x)$, $D(f(x))$.
:::

:::formula{title="Algebra of derivatives"}
For $u = f(x)$ and $v = g(x)$, both differentiable:
$$(u \pm v)' = u' \pm v'$$
$$(\lambda u)' = \lambda u'$$
$$(uv)' = u'v + uv'$$
$$\left(\frac{u}{v}\right)' = \frac{u'v - uv'}{v^2}$$
The quotient rule needs $v \ne 0$. The product rule is NCERT's Leibnitz rule.
:::

## Standard derivatives

:::formula{title="Powers and constants"}
$$\frac{d}{dx}(c) = 0$$
$$\frac{d}{dx}(x^n) = n\,x^{n-1}$$
$c$ = any constant. NCERT proves the power rule for positive integers $n$ and states (without proof) that it holds for every real $n$. For non-integer $n$, use it for $x > 0$: for example $\sqrt x$ has no derivative at $x = 0$.
:::

:::formula{title="Useful power cases"}
$$\frac{d}{dx}\left(\frac1x\right) = -\frac{1}{x^2}$$
$$\frac{d}{dx}\left(\sqrt x\right) = \frac{1}{2\sqrt x}$$
The first for $x \ne 0$, the second for $x > 0$.
:::

:::formula{title="Polynomial"}
$$\frac{d}{dx}\left(a_n x^n + \cdots + a_1 x + a_0\right)$$
$$= n a_n x^{n-1} + \cdots + 2a_2 x + a_1$$
:::

:::formula{title="Trigonometric functions"}
$$\frac{d}{dx}(\sin x) = \cos x$$
$$\frac{d}{dx}(\cos x) = -\sin x$$
$$\frac{d}{dx}(\tan x) = \sec^2 x$$
$$\frac{d}{dx}(\cot x) = -\operatorname{cosec}^2 x$$
$$\frac{d}{dx}(\sec x) = \sec x \tan x$$
$$\frac{d}{dx}(\operatorname{cosec} x) = -\operatorname{cosec} x \cot x$$
$\tan$ and $\sec$: where $\cos x \ne 0$. $\cot$ and $\operatorname{cosec}$: where $\sin x \ne 0$.
:::

:::formula{title="Linear inside a power"}
$$\frac{d}{dx}(ax + b)^n = n\,a\,(ax + b)^{n-1}$$
For a positive integer $n$ you can check it by the binomial theorem. In general it is the chain rule (Class 12).
:::

## Exam extras (in the JEE Main syllabus, not in NCERT)

:::formula{title="More standard limits"}
$$\lim_{x \to 0} \frac{1 - \cos x}{x^2} = \frac12$$
$$\lim_{x \to 0} \frac{(1 + x)^n - 1}{x} = n$$
Both follow from the NCERT results above (the second for rational $n$, using $y = 1 + x \to 1$). NCERT only has the special case $n = 5$ as an exercise.
:::

:::formula{title="Exponential and log limits"}
$$\lim_{x \to 0} \frac{e^x - 1}{x} = 1$$
$$\lim_{x \to 0} \frac{a^x - 1}{x} = \log_e a$$
$$\lim_{x \to 0} \frac{\log_e (1 + x)}{x} = 1$$
$$\lim_{x \to 0} (1 + x)^{1/x} = e$$
The $a^x$ limit needs $a > 0$.
:::

:::formula{title="Rational function as x → ∞"}
For $\dfrac{p(x)}{q(x)}$ with leading terms $a x^m$ and $b x^n$:
- $m < n$: the limit is 0;
- $m = n$: the limit is $\dfrac{a}{b}$;
- $m > n$: no finite limit.
:::
