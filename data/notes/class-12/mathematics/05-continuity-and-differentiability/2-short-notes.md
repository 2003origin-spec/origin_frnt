---
title: "Continuity and Differentiability: Short Notes"
type: short_notes
chapter: c12.mathematics.continuity-and-differentiability
order: 2
---

:::remember
Rolle's theorem and the Mean Value Theorem are no longer in this NCERT chapter (rationalised book), and they are not in the JEE Main 2026 syllabus. Older books still have them.
:::

## 1. Continuity at a point

- Informally: $f$ is continuous at $c$ if you can draw its graph near $c$ **without lifting the pen**.
- Formally: $c$ is in the domain of $f$ and $\displaystyle\lim_{x \to c} f(x) = f(c)$.
- So three things must exist and be equal: the left hand limit (LHL), the right hand limit (RHL) and $f(c)$.
- If $f$ is not continuous at a point $c$ of its domain, $c$ is a **point of discontinuity**.

:::example{title="Two ways to break continuity"}
$f(x) = 1$ for $x \le 0$ and $2$ for $x > 0$: LHL $= 1$, RHL $= 2$, so they differ.

$f(x) = 1$ for $x \ne 0$ and $f(0) = 2$: the limit is 1, but $f(0) = 2$.
:::

## 2. Continuous functions

- $f$ is a **continuous function** if it is continuous at **every point of its domain**.
- On a closed interval $[a, b]$, at $a$ use only the right hand limit, and at $b$ only the left hand limit.
- A function defined at only one point is continuous.
- Points **outside the domain** are not checked. $f(x) = \dfrac1x$ is a continuous function, because 0 is not in its domain.

| Function | Continuous on |
|---|---|
| Polynomials, $\lvert x \rvert$, $\sin x$, $\cos x$ | all of $\mathbb{R}$ |
| Rational $p(x)/q(x)$ | where $q(x) \ne 0$ |
| $\tan x$ | $x \ne$ odd multiples of $\pi/2$ |
| $e^x$; $\log x$ | $\mathbb{R}$; $x > 0$ |
| $[x]$ (greatest integer) | all non-integers |

- $[x]$ is discontinuous at **every integer** $c$: LHL $= c - 1$ but RHL $= c$.
- Inverse trigonometric functions are continuous on their domains (NCERT states this without proof).

## 3. Algebra of continuous functions

- If $f$ and $g$ are continuous at $c$, then $f + g$, $f - g$, $fg$ and $\lambda f$ are continuous at $c$. So is $f/g$ when $g(c) \ne 0$.
- **Composition:** if $g$ is continuous at $c$ and $f$ is continuous at $g(c)$, then $f(g(x))$ is continuous at $c$. This is why $\sin(x^2)$, $|\cos x|$ and $|1 - x + |x||$ are continuous.

## 4. Infinity

- As $x \to 0^+$, $\dfrac1x \to +\infty$; as $x \to 0^-$, $\dfrac1x \to -\infty$.
- $\pm\infty$ is **not a real number**. "The limit is $\infty$" means the limit does **not exist** as a real number.

## 5. Types of discontinuity (exam extra, not in NCERT)

- **Removable:** the limit exists but is not equal to $f(c)$. Redefining $f(c)$ fixes it.
- **Jump:** LHL and RHL both exist but differ, as for $[x]$ at an integer.
- **Infinite:** a one-sided limit is $\pm\infty$, at a point where $f$ **is** defined (for example $f(x) = \dfrac1x$ for $x \ne 0$ and $f(0) = 0$).
- With NCERT's convention, a point outside the domain is not a discontinuity at all: $\dfrac1x$ alone, with 0 left out, is a continuous function.

## 6. Differentiability

- $f'(c) = \displaystyle\lim_{h \to 0} \frac{f(c+h) - f(c)}{h}$, if this limit exists.
- Find the **left hand derivative** ($h \to 0^-$) and the **right hand derivative** ($h \to 0^+$). $f$ is differentiable at $c$ when both are finite and equal.
- On $[a, b]$, use the one-sided derivatives at the end points, as for continuity.
- **Differentiable ⇒ continuous.** The converse is false.
- Graph picture: a **sharp corner** (like $|x|$ at 0) means continuous but not differentiable. A **break** means neither.

:::example{title="|x| at 0"}
LHD $= \displaystyle\lim_{h \to 0^-} \frac{|h|}{h} = -1$ and RHD $= +1$. They differ, so $|x|$ is not differentiable at 0, though it is continuous there.
:::

## 7. Chain rule

- For a function of a function: $\dfrac{dy}{dx} = \dfrac{dy}{dt} \cdot \dfrac{dt}{dx}$. Differentiate the outside, keep the inside, then multiply by the derivative of the inside.
- It extends to any number of links.

:::example{title="Chain rule"}
$\dfrac{d}{dx}\sin(x^2) = \cos(x^2) \cdot 2x = 2x\cos(x^2)$
:::

## 8. Implicit functions

- When $y$ is not given as $y = f(x)$ (for example $x + \sin xy - y = 0$), differentiate **every term** with respect to $x$, treating $y$ as a function of $x$.
- Each term in $y$ picks up a factor $\dfrac{dy}{dx}$: $\dfrac{d}{dx}(y^2) = 2y\dfrac{dy}{dx}$. Then collect the $\dfrac{dy}{dx}$ terms and solve.

:::example{title="Implicit"}
$y + \sin y = \cos x$ gives $\dfrac{dy}{dx}(1 + \cos y) = -\sin x$, so $\dfrac{dy}{dx} = -\dfrac{\sin x}{1 + \cos y}$, for $y \ne (2n+1)\pi$.
:::

## 9. Inverse trigonometric functions

- Put $y = \sin^{-1} x$, so $x = \sin y$. Then $1 = \cos y \dfrac{dy}{dx}$. As $y \in \left(-\frac{\pi}{2}, \frac{\pi}{2}\right)$, $\cos y = \sqrt{1 - x^2}$ (positive). So $\dfrac{dy}{dx} = \dfrac{1}{\sqrt{1 - x^2}}$ for $-1 < x < 1$.
- In the same way, $\dfrac{d}{dx}\cos^{-1} x = \dfrac{-1}{\sqrt{1 - x^2}}$ on $(-1, 1)$ and $\dfrac{d}{dx}\tan^{-1} x = \dfrac{1}{1 + x^2}$ on $\mathbb{R}$.
- **Substitution:** for expressions like $\sin^{-1}\dfrac{2x}{1 + x^2}$, put $x = \tan\theta$ and simplify first. Check the range (see the Traps note).

## 10. Exponential and logarithmic functions

- For $b > 1$, $y = b^x$ has domain $\mathbb{R}$ and range $(0, \infty)$. Its graph passes through $(0, 1)$, always rises, and gets close to the $x$-axis for large negative $x$ without meeting it.
- $\log_b a = x$ means $b^x = a$. For $b > 1$, $\log_b x$ has domain $(0, \infty)$ and range $\mathbb{R}$. Its graph passes through $(1, 0)$, always rises, and gets close to the $y$-axis as $x \to 0^+$ without meeting it.
- $y = e^x$ and $y = \log x$ are **mirror images in the line** $y = x$.
- Rules: $\log_b pq = \log_b p + \log_b q$, $\log_b \dfrac{p}{q} = \log_b p - \log_b q$, $\log_b p^n = n\log_b p$, and the change of base rule.
- $e^{\log x} = x$ is true **only for** $x > 0$.
- $\dfrac{d}{dx}e^x = e^x$ and $\dfrac{d}{dx}\log x = \dfrac1x$. Also $\dfrac{d}{dx}a^x = a^x \log a$ (write $a^x = e^{x\log a}$).

## 11. Logarithmic differentiation

- Use it for $y = [u(x)]^{v(x)}$ (variable base **and** variable power), and for long products and quotients.
- Steps: take $\log$ of both sides, differentiate, then multiply by $y$.
- $u(x)$ and $y$ must be **positive**, or the logs are not defined.

:::example{title="x to the power sin x"}
$y = x^{\sin x}$ ($x > 0$): $\log y = \sin x \log x$, so $\dfrac1y\dfrac{dy}{dx} = \dfrac{\sin x}{x} + \cos x \log x$.

$\dfrac{dy}{dx} = x^{\sin x}\left(\dfrac{\sin x}{x} + \cos x \log x\right)$
:::

- For a sum like $y^x + x^y + x^x = a^b$, put $u = y^x$, $v = x^y$, $w = x^x$ and differentiate each separately. Logs do **not** split a sum.

## 12. Parametric form

- If $x = f(t)$ and $y = g(t)$, then $\dfrac{dy}{dx} = \dfrac{g'(t)}{f'(t)}$, where $f'(t) \ne 0$. The answer is in terms of $t$ only.

:::example{title="Parabola"}
$x = at^2$, $y = 2at$: $\dfrac{dy}{dx} = \dfrac{2a}{2at} = \dfrac1t$.
:::

## 13. Second order derivative

- Differentiate $\dfrac{dy}{dx}$ once more to get $\dfrac{d^2y}{dx^2}$, also written $f''(x)$, $y''$, $y_2$, $D^2y$.
- Typical task: show that $y$ satisfies a relation. For $y = A\sin x + B\cos x$, $y_2 = -y$, so $y_2 + y = 0$.
- Clearing a root before the second differentiation keeps the work short. For $y = \sin^{-1}x$: $(1 - x^2)y_1^2 = 1$, then differentiate to get $(1 - x^2)y_2 - xy_1 = 0$.

## 14. Derivative of one function with respect to another

- To differentiate $u(x)$ with respect to $v(x)$, find $\dfrac{du}{dx} \div \dfrac{dv}{dx}$.
- Example: $\sin^2 x$ with respect to $e^{\cos x}$ gives $\dfrac{2\sin x\cos x}{-\sin x\, e^{\cos x}} = -\dfrac{2\cos x}{e^{\cos x}}$ (where $\sin x \ne 0$).
