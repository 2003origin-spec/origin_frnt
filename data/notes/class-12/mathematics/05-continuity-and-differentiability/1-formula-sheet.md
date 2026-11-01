---
title: "Continuity and Differentiability: Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.continuity-and-differentiability
order: 1
---

In this chapter (as in NCERT), $\log x$ means the **natural logarithm** $\log_e x$, also written $\ln x$.

## Continuity

:::formula{title="Continuity at a point"}
$$\lim_{x \to c} f(x) = f(c)$$
$c$ must be in the domain of $f$. In practice, check that the left hand limit, the right hand limit and $f(c)$ all exist and are equal.
:::

:::formula{title="Continuity at the end points of [a, b]"}
$$\lim_{x \to a^+} f(x) = f(a)$$
$$\lim_{x \to b^-} f(x) = f(b)$$
Only the one-sided limit from inside the interval is used.
:::

:::formula{title="Algebra of continuous functions"}
If $f$ and $g$ are continuous at $c$, so are
$$f + g, \quad f - g, \quad f \cdot g$$
and $\dfrac{f}{g}$, provided $g(c) \ne 0$.
:::

:::formula{title="Composite functions"}
If $g$ is continuous at $c$ and $f$ is continuous at $g(c)$, then $f \circ g$ is continuous at $c$.
So $|f|$, $\sin(f)$, $e^{f}$ are continuous wherever $f$ is.
:::

## Differentiability

:::formula{title="Derivative at a point"}
$$f'(c) = \lim_{h \to 0} \frac{f(c + h) - f(c)}{h}$$
:::

:::formula{title="Left and right hand derivatives"}
$$\text{LHD} = \lim_{h \to 0^-} \frac{f(c + h) - f(c)}{h}$$
$$\text{RHD} = \lim_{h \to 0^+} \frac{f(c + h) - f(c)}{h}$$
$f$ is differentiable at $c$ only when both are **finite and equal**.
:::

:::formula{title="Differentiable means continuous"}
$$\text{differentiable at } c \Rightarrow \text{continuous at } c$$
The converse is false: $|x|$ is continuous at 0 but not differentiable there (LHD $= -1$, RHD $= 1$).
:::

## Rules of differentiation

:::formula{title="Sum, product, quotient"}
$$(u \pm v)' = u' \pm v'$$
$$(uv)' = u'v + uv'$$
$$\left(\frac{u}{v}\right)' = \frac{u'v - uv'}{v^2}$$
The quotient rule needs $v \ne 0$.
:::

:::formula{title="Chain rule"}
If $y = f(t)$ and $t = g(x)$, and both $\dfrac{dy}{dt}$ and $\dfrac{dt}{dx}$ exist:
$$\frac{dy}{dx} = \frac{dy}{dt} \cdot \frac{dt}{dx}$$
For three links, $\dfrac{dy}{dx} = \dfrac{dy}{ds} \cdot \dfrac{ds}{dt} \cdot \dfrac{dt}{dx}$.
:::

## Standard derivatives

:::formula{title="Powers and trigonometric functions (Class 11)"}
$$\frac{d}{dx}\left(x^n\right) = n\,x^{n-1}$$
$$\frac{d}{dx}(\sin x) = \cos x$$
$$\frac{d}{dx}(\cos x) = -\sin x$$
$$\frac{d}{dx}(\tan x) = \sec^2 x$$
$$\frac{d}{dx}(\cot x) = -\operatorname{cosec}^2 x$$
$$\frac{d}{dx}(\sec x) = \sec x \tan x$$
$$\frac{d}{dx}(\operatorname{cosec} x) = -\operatorname{cosec} x \cot x$$
The power rule holds for every real $n$ when $x > 0$, and for integer $n$ wherever $x^n$ is defined. (It fails at $x = 0$ for $\sqrt{x}$.) The trigonometric results hold wherever the function is defined.
:::

:::formula{title="Inverse trigonometric functions"}
$$\frac{d}{dx}\left(\sin^{-1} x\right) = \frac{1}{\sqrt{1 - x^2}}$$
$$\frac{d}{dx}\left(\cos^{-1} x\right) = \frac{-1}{\sqrt{1 - x^2}}$$
These two hold for $-1 < x < 1$ only (not at $x = \pm 1$).
$$\frac{d}{dx}\left(\tan^{-1} x\right) = \frac{1}{1 + x^2}$$
This holds for every real $x$.
:::

:::formula{title="Other inverse functions (exam extra: JEE Main syllabus, not in NCERT)"}
$$\frac{d}{dx}\left(\cot^{-1} x\right) = \frac{-1}{1 + x^2}$$
$$\frac{d}{dx}\left(\sec^{-1} x\right) = \frac{1}{|x|\sqrt{x^2 - 1}}$$
$$\frac{d}{dx}\operatorname{cosec}^{-1} x = \frac{-1}{|x|\sqrt{x^2 - 1}}$$
The first holds for every real $x$; the last two hold for $|x| > 1$.
:::

:::formula{title="Exponential and logarithmic functions"}
$$\frac{d}{dx}\left(e^x\right) = e^x$$
$$\frac{d}{dx}(\log x) = \frac{1}{x} \quad (x > 0)$$
$$\frac{d}{dx}\left(a^x\right) = a^x \log a \quad (a > 0)$$
$$\frac{d}{dx}\left(\log_a x\right) = \frac{1}{x \log a}$$
For $\log_a x$: $x > 0$, $a > 0$, $a \ne 1$. Change of base: $\log_a p = \dfrac{\log_b p}{\log_b a}$.
:::

## Special methods

:::formula{title="Logarithmic differentiation"}
For $y = [u(x)]^{v(x)}$ with $u(x) > 0$, take logs: $\log y = v \log u$. Then
$$\frac{dy}{dx} = u^{v}\left[\frac{v\,u'}{u} + v' \log u\right]$$
Example: $\dfrac{d}{dx}\left(x^x\right) = x^x\,(1 + \log x)$ for $x > 0$.
:::

:::formula{title="Parametric form"}
If $x = f(t)$ and $y = g(t)$:
$$\frac{dy}{dx} = \frac{dy/dt}{dx/dt} = \frac{g'(t)}{f'(t)}$$
Valid only where $f'(t) \ne 0$.
:::

:::formula{title="Second derivative in parametric form"}
$$\begin{aligned} \frac{d^2y}{dx^2} &= \frac{d}{dt}\left(\frac{dy}{dx}\right) \\ &\quad \div \frac{dx}{dt} \end{aligned}$$
It is **not** $\dfrac{d^2y/dt^2}{d^2x/dt^2}$.
:::

:::formula{title="Derivative of one function with respect to another"}
$$\frac{du}{dv} = \frac{du/dx}{dv/dx}$$
Valid where $\dfrac{dv}{dx} \ne 0$.
:::

:::formula{title="Second order derivative"}
$$\frac{d^2y}{dx^2} = \frac{d}{dx}\left(\frac{dy}{dx}\right)$$
Also written $f''(x)$, $y''$, $y_2$ or $D^2y$. Likewise $y_1 = \dfrac{dy}{dx}$.
:::
