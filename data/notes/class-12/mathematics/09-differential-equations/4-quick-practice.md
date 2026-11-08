---
title: "Differential Equations: Quick Practice"
type: practice
chapter: c12.mathematics.differential-equations
order: 4
---

Try each question first, then tap **Show answer**. $\log$ means $\log_e$.

## Order and degree

:::question{title="1. Order plus degree" exam="JEE Main level"}
Find (order + degree) of the differential equation below. Use the usual exam convention: clear fractional powers first.
$$\left(\frac{d^3y}{dx^3}\right)^{2/3} = 1 + \frac{dy}{dx}$$

---

Cube both sides to clear the fractional power: $\left(y'''\right)^2 = (1 + y')^3$.

Highest derivative $y'''$: order 3. Its power: degree 2. Order + degree = **5**.
:::

:::question{title="2. Degree not defined" exam="JEE Main level"}
For which equation is the degree **not** defined?

(A) $y'' + e^{y} = 0$ (B) $(y')^2 + \log x = 0$ (C) $y'' + e^{y'} = 0$ (D) $(y'')^3 = 1 + (y')^4$

---

(A) and (B): only $y$ or $x$ sits inside the function, so the degrees are 1 and 2. (D) is a polynomial in the derivatives, with degree 3.

(C) has $e^{y'}$, which is not a polynomial in $y'$. Answer: **(C)**.
:::

## Variables separable

:::question{title="3. Particular solution" exam="JEE Main level"}
Solve $(1 + x^2)\dfrac{dy}{dx} = 2x(y + 1)$, given $y = 1$ when $x = 0$. Find $y$ when $x = 2$.

---

Separate: $\dfrac{dy}{y + 1} = \dfrac{2x\,dx}{1 + x^2}$, so $\log|y + 1| = \log(1 + x^2) + C_1$, and $y + 1 = A(1 + x^2)$.

$x = 0$, $y = 1$: $A = 2$. So $y = 2x^2 + 1$, and at $x = 2$, $y =$ **9**.
:::

:::question{title="4. Continuous growth" exam="JEE Main level"}
Money in a bank grows continuously at $r\%$ per year. It becomes 4 times in 20 years. Find $r$. (Use $\log 2 = 0.693$.)

---

$\dfrac{dP}{dt} = \dfrac{r}{100}P$ gives $P = P_0\,e^{rt/100}$.

$4 = e^{20r/100}$, so $\dfrac{r}{5} = \log 4 = 2\log 2$, and $r = 10\log 2 \approx$ **6.93** (per cent per year).
:::

## Homogeneous equations

:::question{title="5. Which is homogeneous?" exam="JEE Main level"}
Which differential equation is homogeneous?

(A) $\dfrac{dy}{dx} = \dfrac{x - y}{x + y + 1}$ (B) $\dfrac{dy}{dx} = \dfrac{x^3 + y^3}{xy^2}$ (C) $\dfrac{dy}{dx} = \sin x + \cos y$ (D) $\dfrac{dy}{dx} = \dfrac{x^2 + y}{x^2}$

---

In (B), the top and bottom both have degree 3, so $F(\lambda x, \lambda y) = F(x, y)$.

(A) has the constant 1, (C) is not of the form $g(y/x)$, and (D) mixes degrees 2 and 1. Answer: **(B)**.
:::

:::question{title="6. Homogeneous, with a condition" exam="JEE Main level"}
Solve $\dfrac{dy}{dx} = \dfrac{y}{x} + \tan\dfrac{y}{x}$ for $x > 0$, given $y = \dfrac{\pi}{6}$ when $x = 1$. Find $y$ at $x = \sqrt3$.

---

Put $y = vx$: $v + x\dfrac{dv}{dx} = v + \tan v$, so $\cot v\,dv = \dfrac{dx}{x}$.

$\log|\sin v| = \log x + \log|C|$, so $\sin\dfrac{y}{x} = Cx$. The condition gives $\sin\dfrac{\pi}{6} = C$, so $C = \dfrac12$.

At $x = \sqrt3$: $\sin\dfrac{y}{x} = \dfrac{\sqrt3}{2}$. Since $\dfrac{y}{x}$ starts at $\dfrac{\pi}{6}$ and stays in $\left(0, \dfrac{\pi}{2}\right)$, $\dfrac{y}{x} = \dfrac{\pi}{3}$ and $y =$ **$\dfrac{\pi}{\sqrt3}$**.
:::

## Linear equations

:::question{title="7. Integrating factor sec x" exam="JEE Main level"}
Solve $\dfrac{dy}{dx} + y\tan x = \sec x$, $0 \le x < \dfrac{\pi}{2}$, given $y(0) = 1$. Find $y\left(\dfrac{\pi}{4}\right)$.

---

$\text{I.F.} = e^{\int \tan x\,dx} = \sec x$. So $y\sec x = \displaystyle\int \sec^2 x\,dx = \tan x + C$, and $y = \sin x + C\cos x$.

$y(0) = 1$ gives $C = 1$, so $y = \sin x + \cos x$, and $y\left(\dfrac{\pi}{4}\right) =$ **$\sqrt2$**.
:::

:::question{title="8. Divide first" exam="JEE Main level"}
Solve $x\dfrac{dy}{dx} - y = x^2e^x$ for $x > 0$, given $y = e + 1$ when $x = 1$. Find $y$ at $x = 2$.

---

Divide by $x$: $\dfrac{dy}{dx} - \dfrac{y}{x} = xe^x$. $\text{I.F.} = e^{-\log x} = \dfrac1x$.

$\dfrac{y}{x} = \displaystyle\int e^x\,dx = e^x + C$, so $y = xe^x + Cx$. The condition gives $C = 1$.

At $x = 2$: $y =$ **$2e^2 + 2$**.
:::

:::question{title="9. Linear in x" exam="JEE Main level"}
A curve with $y > 0$ satisfies $y\,dx - (x + y^3)\,dy = 0$ and passes through $(1, 1)$. Find $x$ when $y = 2$.

---

It is linear in $x$: $\dfrac{dx}{dy} - \dfrac{x}{y} = y^2$. $\text{I.F.} = e^{-\log y} = \dfrac1y$.

$\dfrac{x}{y} = \displaystyle\int y\,dy = \dfrac{y^2}{2} + C$, so $x = \dfrac{y^3}{2} + Cy$. Through $(1, 1)$: $C = \dfrac12$.

So $x = \dfrac{y^3 + y}{2}$, and at $y = 2$, $x =$ **5**.
:::

## Curves

:::question{title="10. Slope condition" exam="JEE Main level"}
A curve passes through the origin. At every point $(x, y)$ on it, the slope of the tangent is $2x - y$. Find $y$ at $x = 1$.

---

$\dfrac{dy}{dx} + y = 2x$. $\text{I.F.} = e^x$, so $ye^x = \displaystyle\int 2xe^x\,dx = 2e^x(x - 1) + C$.

$y = 2x - 2 + Ce^{-x}$. Through $(0, 0)$: $C = 2$. So $y = 2x - 2 + 2e^{-x}$, and $y(1) =$ **$\dfrac{2}{e}$**.
:::
