---
title: "Differential Equations: Important Points and Traps"
type: key_points
chapter: c12.mathematics.differential-equations
order: 3
---

## Order and degree

:::remember
- Order = the highest derivative present. Degree = the highest power of **that** derivative, once the equation is a polynomial in the derivatives.
- Order and degree (if defined) are always **positive integers**.
- General solution: as many arbitrary constants as the order. Particular solution: **none**.
:::

:::trap
**Degree is not the highest power of any derivative.** In $y'' + (y')^5 = 0$ the degree is 1, not 5. Only the power of the highest-order derivative counts.
:::

:::trap
**A function of a derivative kills the degree.** $\sin(y')$, $\cos(y'')$, $e^{y'}$ or $\log(y')$ make the degree **not defined**. But $\sin y$, $e^y$ or $\log x$ are fine: only the derivatives must appear as a polynomial.

So $y'' + 2y' + \sin y = 0$ has degree 1, while $y'' + \cos(y') = 0$ has no degree.
:::

:::trap
**Clear roots and fractional powers first.** NCERT does not discuss this case (it only says the equation must be a polynomial in the derivatives). The usual exam convention: raise both sides to a power so that every derivative has a whole-number power, then read the degree.

$y'' = \left[1 + (y')^2\right]^{3/2}$ becomes $(y'')^2 = \left[1 + (y')^2\right]^3$: order 2, **degree 2**, not 1.
:::

## Variables separable

:::trap
**Dividing can lose a solution.** To separate $\dfrac{dy}{dx} = g(x)\,h(y)$ you divide by $h(y)$, so any constant $y = k$ with $h(k) = 0$ is a solution that may not appear in your answer. For $\dfrac{dy}{dx} = -4xy^2$, $y = 0$ is a solution, but $y = \dfrac{1}{2x^2 - C}$ never gives it.
:::

- Add the constant **once**, on one side, right after integrating. Then choose a handy form: $\log|C|$, $e^{C}$ or $2C$ are all just "some constant".
- $\log|y| = x + C_1$ gives $y = Ce^{x}$. Here $C = \pm e^{C_1}$, and $C = 0$ also works (it gives $y = 0$).
- Apply the given condition **after** finding the general solution, not before integrating.

:::remember
NCERT growth questions: "rate of growth proportional to the number present" means $\dfrac{dP}{dt} = kP$, so $P = P_0e^{kt}$. Continuous interest at $r\%$ per year means $k = \dfrac{r}{100}$. Rs 1000 at 5% doubles in $20\log 2 \approx 13.9$ years.
:::

## Homogeneous equations

:::trap
**Constant terms break homogeneity.** $(4x + 6y + 5)\,dy = (3y + 2x + 4)\,dx$ is **not** homogeneous. For a fraction of polynomials, every term in the top and in the bottom must have the same total degree.
:::

:::trap
**After $y = vx$, $\dfrac{dy}{dx}$ is not $v$.** It is $v + x\dfrac{dv}{dx}$. Forgetting that extra $v$ is the most common slip.
:::

- Always put $v = \dfrac{y}{x}$ back at the end. An answer still in $v$ is incomplete.
- If the equation is easier as $\dfrac{dx}{dy} = h\!\left(\dfrac{x}{y}\right)$ (terms like $e^{x/y}$), use $x = vy$.

:::tip
**Quick test:** replace $x$ by $\lambda x$ and $y$ by $\lambda y$ in $F(x, y)$. If every $\lambda$ cancels, the equation is homogeneous.
:::

## Linear equations

:::trap
**Make the coefficient of $\dfrac{dy}{dx}$ equal to 1 first.** For $x\dfrac{dy}{dx} - y = 2x^2$, $P = -\dfrac1x$ (not $-1$), so $\text{I.F.} = \dfrac1x$, not $e^{-x}$.
:::

:::trap
**Watch the sign of $P$.** $P$ is the coefficient of $y$ when the equation reads $\dfrac{dy}{dx} + Py = Q$. In $\dfrac{dy}{dx} - xy = x$, $P = -x$ and $\text{I.F.} = e^{-x^2/2}$.
:::

:::trap
**Do not forget $C$, and divide every term by the I.F.** From $y\,x^2 = \dfrac{x^4}{4} + C$ the answer is $y = \dfrac{x^2}{4} + \dfrac{C}{x^2}$. Writing $y = \dfrac{x^2}{4} + C$ is wrong.
:::

- No constant is needed inside $e^{\int P\,dx}$. Any constant there only multiplies the I.F. and cancels.
- If $y$ appears in a non-linear way ($y^2$, $e^y$, $\tan^{-1}y$) but $x$ appears only to the first power, the equation is often **linear in $x$**. Try writing $\dfrac{dx}{dy} + P_1x = Q_1$. Examples: $y\,dx - (x + 2y^2)\,dy = 0$ and $(\tan^{-1}y - x)\,dy = (1 + y^2)\,dx$.

:::remember
- $e^{\log f(x)} = f(x)$. So $e^{2\log x} = x^2$ and $e^{-\log x} = \dfrac1x$.
- I.F. for $\cot x$ is $\sin x$; for $\tan x$ it is $\sec x$; for $\dfrac{2x}{1 + x^2}$ it is $1 + x^2$.
:::

## Spotting the type

:::tip
Look before you work:
- $x$ and $y$ in **separate factors**: separate.
- Every term of the **same degree**: $y = vx$.
- $y$ and $y'$ only to the **first power**, not multiplied together: I.F.
- Linear in $x$ (with $y$ as the variable): I.F. with $dy$.
:::

- An equation can fit more than one type. Pick the easiest.
- Forming a differential equation by eliminating arbitrary constants was **removed** from the current NCERT chapter (its introduction still mentions it, but the section is gone). The JEE Main 2026 syllabus lists only order, degree and the three methods above.

## Curves

- "Slope of the tangent at $(x, y)$" is $\dfrac{dy}{dx}$. "Passes through a point" gives the constant.
- NCERT example: a curve through $(0, 1)$ whose slope is $x + xy$ is $y = -1 + 2e^{x^2/2}$.
