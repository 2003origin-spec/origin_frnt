---
title: "Differential Equations: Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.differential-equations
order: 1
---

As in NCERT, $\log$ means the natural log ($\log_e$), and $C$ is an arbitrary constant.

## Order and degree

:::formula{title="Order"}
Order = the order of the **highest** derivative in the equation.

For $y''' + x^2 (y'')^3 = 0$, the order is 3.
:::

:::formula{title="Degree"}
Degree = the highest power of the **highest-order** derivative.

Defined only when the equation is a **polynomial in the derivatives** $y', y'', \dots$ For $y''' + (y'')^2 - y' + y = 0$, the degree is 1.

Roots or fractional powers of a derivative: NCERT does not cover this case. The usual exam convention is to clear them first (raise both sides to a power), then read the degree.
:::

:::formula{title="Number of arbitrary constants"}
General solution: as many arbitrary constants as the **order**.

Particular solution: **no** arbitrary constants.
:::

## Variables separable

:::formula{title="Separate, then integrate"}
If $\dfrac{dy}{dx} = g(x)\,h(y)$ and $h(y) \ne 0$:
$$\int \frac{dy}{h(y)} = \int g(x)\,dx + C$$
The answer has the form $H(y) = G(x) + C$.
:::

## Homogeneous equations

:::formula{title="Homogeneous function of degree n"}
$$F(\lambda x, \lambda y) = \lambda^n F(x, y)$$
For every non-zero $\lambda$. Then $F(x, y) = x^n g\!\left(\dfrac{y}{x}\right)$.
:::

:::formula{title="Homogeneous differential equation"}
$\dfrac{dy}{dx} = F(x, y)$ is **homogeneous** when $F$ is homogeneous of **degree zero**, so that
$$\frac{dy}{dx} = g\!\left(\frac{y}{x}\right)$$
:::

:::formula{title="Substitution y = vx"}
$$y = vx$$
$$\frac{dy}{dx} = v + x\frac{dv}{dx}$$
The equation becomes separable (where $g(v) \ne v$):
$$\int \frac{dv}{g(v) - v} = \int \frac{dx}{x} + C$$
At the end, put back $v = \dfrac{y}{x}$.
:::

:::formula{title="Substitution x = vy"}
Use it when the equation is $\dfrac{dx}{dy} = h\!\left(\dfrac{x}{y}\right)$:
$$x = vy$$
$$\frac{dx}{dy} = v + y\frac{dv}{dy}$$
:::

## Linear equations

:::formula{title="Linear in y"}
$$\frac{dy}{dx} + Py = Q$$
$P$ and $Q$ are constants or functions of $x$ only.
$$\text{I.F.} = e^{\int P\,dx}$$
$$y \cdot \text{I.F.} = \int Q \cdot \text{I.F.}\,dx + C$$
Make the coefficient of $\dfrac{dy}{dx}$ equal to 1 **before** reading off $P$.
:::

:::formula{title="Linear in x"}
$$\frac{dx}{dy} + P_1 x = Q_1$$
$P_1$ and $Q_1$ are constants or functions of $y$ only.
$$\text{I.F.} = e^{\int P_1\,dy}$$
$$x \cdot \text{I.F.} = \int Q_1 \cdot \text{I.F.}\,dy + C$$
:::

### Useful integrating factors

$e^{\log f(x)} = f(x)$ turns most integrating factors into simple functions:

| $P$ | I.F. |
|---|---|
| $k$ (a constant) | $e^{kx}$ |
| $n/x$ | $x^n$ |
| $-1/x$ | $1/x$ |
| $\tan x$ | $\sec x$ |
| $\cot x$ | $\sin x$ |

Strictly, $e^{\log|x|} = |x|$. But on an interval where $x$ (or $\cos x$, $\sin x$) keeps one sign, $|x|$ and $x$ differ only by the constant factor $-1$, and any non-zero constant multiple of an I.F. is still an I.F. So you may drop the modulus, as NCERT does.

## Growth and decay

:::formula{title="Rate proportional to the amount"}
$$\frac{dP}{dt} = kP$$
$$P = P_0\,e^{kt}$$
$P_0$ = amount at $t = 0$, $k$ = constant rate (per unit time). $k > 0$: growth. $k < 0$: decay.
:::

:::formula{title="Doubling time"}
$$t_2 = \frac{\log 2}{k}$$
Only for growth ($k > 0$). For growth at $r\%$ per year compounded continuously, $k = \dfrac{r}{100}$ per year.
:::

## Curves

:::formula{title="Slope of the tangent"}
Slope of the tangent at $(x, y)$:
$$m = \frac{dy}{dx}$$
Write the given condition as an equation in $\dfrac{dy}{dx}$, solve it, then use the given point to find $C$.
:::

## Two extra tools

:::formula{title="Equations of the form y′ = f(ax + by + c)"}
Put $t = ax + by + c$ (with $b \ne 0$). Then
$$\frac{dt}{dx} = a + b\,f(t)$$
which is separable. NCERT uses this only as a hint in its Miscellaneous Exercise ("put $x - y = t$"); it is not a named method in NCERT or the JEE Main syllabus. It just turns the equation into a separable one.
:::

:::formula{title="Exact differentials (beyond the syllabus)"}
$$x\,dy + y\,dx = d(xy)$$
$$\frac{x\,dy - y\,dx}{x^2} = d\!\left(\frac{y}{x}\right)$$
$$x\,dx + y\,dy = \tfrac12\,d(x^2 + y^2)$$
Not in NCERT or the JEE Main syllabus, but spotting these can solve an equation in one line.
:::
