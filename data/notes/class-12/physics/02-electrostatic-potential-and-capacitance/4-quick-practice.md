---
title: "Potential and Capacitance: Quick Practice"
type: practice
chapter: c12.physics.electrostatic-potential-and-capacitance
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. Take $\dfrac{1}{4\pi\varepsilon_0} = 9 \times 10^9$ N m² C⁻² and $V = 0$ at infinity.

## Potential

:::question{title="1. Where is V zero?" exam="NEET level"}
A charge of $+4\ \mu$C is at $x = 0$ and a charge of $-1\ \mu$C is at $x = 30$ cm. At which points on the $x$-axis is the potential zero?

---

Let the point be at $x$ (in cm).

Between the charges: $\dfrac{4}{x} = \dfrac{1}{30 - x}$, so $120 - 4x = x$ and $x = 24$ cm.

Beyond the $-1\ \mu$C charge: $\dfrac{4}{x} = \dfrac{1}{x - 30}$, so $4x - 120 = x$ and $x = 40$ cm.

To the left of $x = 0$ there is no solution. So **$x$ = 24 cm and $x$ = 40 cm**.
:::

:::question{title="2. Work by the field" exam="NEET level"}
A charge of $3\ \mu$C moves from point A ($V_A = +20$ V) to point B ($V_B = -30$ V). Find the work done by the electric field. If the charge starts at rest at A and only the field acts on it, what is its kinetic energy at B?

---

$W_{\text{field}} = q(V_A - V_B) = 3 \times 10^{-6} \times 50 =$ **$1.5 \times 10^{-4}$ J**.

All of it becomes kinetic energy: $K_B =$ **$1.5 \times 10^{-4}$ J**.
:::

:::question{title="3. Field from potential" exam="JEE Main level"}
In a region the potential is $V = 5x^2 - 3y$ (V in volt, $x$ and $y$ in metre). Find the size of the electric field at the point $(1\text{ m}, 2\text{ m})$.

---

$E_x = -\dfrac{\partial V}{\partial x} = -10x = -10$ V/m at $x = 1$.

$E_y = -\dfrac{\partial V}{\partial y} = +3$ V/m.

$|\vec E| = \sqrt{100 + 9} = \sqrt{109} \approx$ **10.4 V/m**.
:::

## Potential energy and dipoles

:::question{title="4. Assembling three charges" exam="NEET level"}
Charges $+1\ \mu$C, $+1\ \mu$C and $-1\ \mu$C are placed at the corners of an equilateral triangle of side 10 cm. How much work must an external agent do to assemble them, starting from infinity?

---

One term for each pair. Each pair has $\dfrac{9 \times 10^9 \times (10^{-6})^2}{0.1} = 0.09$ J in size.

The $(+,+)$ pair gives $+0.09$ J; the two $(+,-)$ pairs give $-0.09$ J each.

$U = 0.09 - 0.09 - 0.09 =$ **$-0.09$ J** (0.09 J is released).
:::

:::question{title="5. Turning a dipole" exam="NEET level"}
A dipole of moment $2 \times 10^{-8}$ C m is in a uniform field of $5 \times 10^4$ N/C. Find the largest torque on it, and the work needed to turn it from the stable position to the unstable position.

---

$\tau_{\max} = pE = 2 \times 10^{-8} \times 5 \times 10^4 =$ **$1 \times 10^{-3}$ N m** (at $90^\circ$).

$W = pE(\cos 0^\circ - \cos 180^\circ) = 2pE =$ **$2 \times 10^{-3}$ J**.
:::

## Conductors and capacitors

:::question{title="6. Charged conducting sphere" exam="NEET level"}
A conducting sphere of radius 10 cm carries a charge of 2 nC. Find the electric field and the potential at its centre, and the potential at 30 cm from the centre.

---

Inside a conductor, **$E = 0$**.

$V$ inside equals the surface value: $V = \dfrac{9 \times 10^9 \times 2 \times 10^{-9}}{0.1} =$ **180 V**.

At 30 cm: $V = \dfrac{18}{0.3} =$ **60 V**.
:::

:::question{title="7. Half-filled gap" exam="JEE Main level"}
A parallel plate capacitor has $C_0 = 10$ pF with air between its plates. A slab of dielectric constant 4, of the same area as the plates and thickness half the gap, is placed between the plates. Find the new capacitance.

---

Use the slab formula (exam extra; or add the two voltage drops as in NCERT Example 2.8):
$$C = \frac{\varepsilon_0 A}{d - t + t/K}$$
With $t = d/2$: the denominator is $\dfrac d2 + \dfrac d8 = \dfrac{5d}{8}$.

So $C = \dfrac85 C_0 = 1.6 \times 10 =$ **16 pF**.
:::

:::question{title="8. Mixed network" exam="NEET level"}
Capacitors of $3\ \mu$F and $6\ \mu$F are joined in series. This pair is joined in parallel with a $4\ \mu$F capacitor, and the whole network is connected to a 12 V battery. Find the equivalent capacitance and the voltage across the $3\ \mu$F capacitor.

---

Series pair: $\dfrac{3 \times 6}{3 + 6} = 2\ \mu$F. With the $4\ \mu$F in parallel: $C =$ **$6\ \mu$F**.

The series pair has 12 V across it, so its charge is $2 \times 12 = 24\ \mu$C. Across the $3\ \mu$F: $V = \dfrac{24}{3} =$ **8 V** (and 4 V across the $6\ \mu$F).
:::

## Energy

:::question{title="9. Sharing charge" exam="JEE Main level"}
A $2\ \mu$F capacitor is charged to 120 V and disconnected from the battery. It is then joined (positive plate to positive plate) to an uncharged $4\ \mu$F capacitor. Find the common potential and the energy lost.

---

Charge is conserved: $Q = 2 \times 120 = 240\ \mu$C, shared by $6\ \mu$F, so $V =$ **40 V**.

Before: $\tfrac12 \times 2 \times 10^{-6} \times 120^2 = 14.4$ mJ.

After: $\tfrac12 \times 6 \times 10^{-6} \times 40^2 = 4.8$ mJ.

Energy lost $=$ **9.6 mJ** (as heat and radiation).
:::

:::question{title="10. Dielectric after the battery is removed" exam="JEE Main level"}
A 10 pF air capacitor is charged to 100 V and the battery is removed. The gap is then completely filled with a dielectric of $K = 5$. Find the new potential difference and the new stored energy.

---

$Q = 10 \times 10^{-12} \times 100 = 10^{-9}$ C stays the same. $C = 5 \times 10 = 50$ pF.

$V = \dfrac{Q}{C} = \dfrac{10^{-9}}{5 \times 10^{-11}} =$ **20 V**.

$U = \tfrac12 QV = \tfrac12 \times 10^{-9} \times 20 =$ **$1 \times 10^{-8}$ J** (down from $5 \times 10^{-8}$ J, so $1/K$ times).
:::
