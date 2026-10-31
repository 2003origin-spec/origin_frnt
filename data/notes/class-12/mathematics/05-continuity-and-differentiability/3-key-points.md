---
title: "Continuity and Differentiability: Important Points and Traps"
type: key_points
chapter: c12.mathematics.continuity-and-differentiability
order: 3
---

## Continuity

:::remember
- $f$ is continuous at $c$ when LHL $=$ RHL $= f(c)$.
- A continuous function is one that is continuous at every point of its **domain**.
- Sum, difference, product and quotient (denominator not zero) of continuous functions are continuous. So is a composite of continuous functions.
- $+\infty$ is **not** a real number. A limit "equal to $\infty$" does not exist.
:::

:::trap
**Only points in the domain count.** This note follows NCERT: $\dfrac1x$ and $\tan x$ are continuous functions, because the points where they are undefined are not in their domains. If a question asks for "points of discontinuity", look only inside the domain.
:::

:::trap
For a piecewise function, check the joining points with **all three** values: LHL, RHL and $f(c)$. Equal one-sided limits are not enough if $f(c)$ is defined differently (NCERT Example 4: $x^3 + 3$ with $f(0) = 1$).
:::

- $[x]$ and $x - [x]$ are discontinuous at **every integer** and continuous everywhere else.
- $x^2 \sin\dfrac1x$ (with value 0 at $x = 0$) is continuous at 0, because $\left|x^2\sin\dfrac1x\right| \le x^2 \to 0$.
- $|f|$ is continuous wherever $f$ is (composite with $|x|$). So $|\cos x|$ and $\sin|x|$ are continuous.
- Continuous + discontinuous at a point is **discontinuous** there. But two discontinuous functions can have a continuous sum or product: if $g(x) = 1$ for $x \ge 0$ and $-1$ for $x < 0$, then $g \cdot g = 1$ everywhere.

:::tip
For "find $k$" questions: set LHL $=$ RHL $= f(c)$ and solve. With two unknowns, there are usually two joining points, giving two equations.
:::

## Differentiability

:::remember
- **Differentiable ⇒ continuous**, but **continuous ⇏ differentiable**.
- Not continuous at $c$ ⇒ certainly not differentiable at $c$.
- Differentiable at $c$: LHD and RHD both finite and equal.
:::

:::trap
$|x - a|$ is continuous everywhere but **not differentiable at** $x = a$ (a corner). $|x - 1| + |x - 2|$ is continuous everywhere but not differentiable at exactly two points, 1 and 2.
:::

- In general, $|f(x)|$ has a corner where $f$ changes sign with $f' \ne 0$ (a simple root). At a double root, such as $|x^2|$ at 0, there is no corner.
- $x|x|$ **is** differentiable at 0: its derivative is $2|x|$, and $f'(0) = 0$.
- $f(x) = |x|^3$ has $f'(x) = 3x|x|$ and $f''(x) = 6|x|$ for all real $x$ (NCERT Miscellaneous Exercise).

:::trap
To test differentiability at a joining point $c$ of a piecewise function, first check **continuity** at $c$. If it fails, stop: not differentiable. If it holds, compare the derivatives of the two pieces at $c$.
:::

## Differentiation rules

:::trap
**Four look-alikes** (for constant $a > 0$, and $x > 0$ where needed):
- $\dfrac{d}{dx}x^a = a\,x^{a-1}$ (power rule)
- $\dfrac{d}{dx}a^x = a^x \log a$ (not $x\,a^{x-1}$)
- $\dfrac{d}{dx}x^x = x^x(1 + \log x)$ (needs logs)
- $\dfrac{d}{dx}a^a = 0$ (a constant)
:::

:::trap
**Implicit differentiation:** every $y$ term gets a factor $\dfrac{dy}{dx}$, and a product like $xy$ needs the product rule: $\dfrac{d}{dx}(xy) = y + x\dfrac{dy}{dx}$.
:::

:::trap
**Logarithmic differentiation** needs a positive base: $y = [u(x)]^{v(x)}$ with $u(x) > 0$. Also, $\log(a + b) \ne \log a + \log b$: for $y = x^x + (\sin x)^x$, differentiate each term separately.
:::

- $\log x$ in NCERT means $\log_e x$. For another base, use change of base first: $\log_7(\log x) = \dfrac{\log(\log x)}{\log 7}$, defined for $x > 1$.
- $e^x$ does not change when differentiated, but $e^{f(x)}$ gives $e^{f(x)}\,f'(x)$ by the chain rule.

:::tip
**"Co" gets a minus.** The derivatives of $\cos$, $\cot$, $\operatorname{cosec}$ and of $\cos^{-1}$, $\cot^{-1}$, $\operatorname{cosec}^{-1}$ all start with a minus sign.
- Inverses: the "co" one is exactly minus its partner, e.g. $\dfrac{d}{dx}\cos^{-1}x = -\dfrac{d}{dx}\sin^{-1}x$.
- Trig functions: from the partner's result, swap every function for its "co" twin and add a minus. $\sin \to \cos$ gives $\cos \to -\sin$; $\tan \to \sec^2$ gives $\cot \to -\operatorname{cosec}^2$.
:::

## Inverse trigonometric substitutions

:::trap
A simplification is true only on the range where it was derived. **Always check the range of $x$ given in the question.**
- $\sin^{-1}\dfrac{2x}{1 + x^2} = 2\tan^{-1}x$ only for $|x| \le 1$. For $x > 1$ it equals $\pi - 2\tan^{-1}x$.
- $\cos^{-1}\dfrac{1 - x^2}{1 + x^2} = 2\tan^{-1}x$ only for $x \ge 0$. For $x < 0$ it equals $-2\tan^{-1}x$.
- $\cos^{-1}(\sin x) = \dfrac{\pi}{2} - x$ only for $-\dfrac{\pi}{2} \le x \le \dfrac{\pi}{2}$.
:::

:::remember
**A note on NCERT Example 40.** Part (iii) puts $2^x = \tan\theta$ and uses $\sin^{-1}(\sin 2\theta) = 2\theta$. That step needs $2\theta \le \dfrac{\pi}{2}$, that is $x \le 0$. So the book's answer $\dfrac{2^{x+1}\log 2}{1 + 4^x}$ is right for $x < 0$. For $x > 0$ the function equals $\pi - 2\tan^{-1}(2^x)$, and the derivative has the opposite sign; at $x = 0$ there is no derivative (a corner). Part (i) has the same point: $f'(x) = -1$ holds on $\left(-\dfrac{\pi}{2}, \dfrac{\pi}{2}\right)$. In an exam, follow the range given in the question.
:::

:::tip
Which substitution?
- $1 + x^2$ or $1 - x^2$ with $2x$: put $x = \tan\theta$.
- $\sqrt{1 - x^2}$: put $x = \sin\theta$ or $\cos\theta$.
- $3x - x^3$ over $1 - 3x^2$: put $x = \tan\theta$, which gives $\tan 3\theta$.
- $1 + \cos x$ or $1 - \cos x$: use half-angle formulas.
:::

- $\dfrac{d}{dx}\sin^{-1}x$ and $\dfrac{d}{dx}\cos^{-1}x$ do **not** exist at $x = \pm 1$, even though the functions are defined there.

## Parametric and second derivatives

:::trap
$\dfrac{d^2y}{dx^2} \ne \dfrac{d^2y/dt^2}{d^2x/dt^2}$. Differentiate $\dfrac{dy}{dx}$ with respect to $t$, then **divide by** $\dfrac{dx}{dt}$.
:::

- $\dfrac{dy}{dx} = \dfrac{dy/dt}{dx/dt}$ needs $\dfrac{dx}{dt} \ne 0$.
- Standard results: $x = a\cos\theta$, $y = a\sin\theta$ give $\dfrac{dy}{dx} = -\cot\theta$. $x = at^2$, $y = 2at$ give $\dfrac{dy}{dx} = \dfrac1t$.
- $y = Ae^{mx} + Be^{nx}$ satisfies $y_2 - (m + n)\,y_1 + mn\,y = 0$. With $m = 2$, $n = 3$: $y_2 - 5y_1 + 6y = 0$.

:::tip
For "show that" second-derivative questions, first write $y_1$ without fractions or roots (for example $(1 - x^2)\,y_1^2 = 1$), then differentiate again. It avoids the quotient rule.
:::
