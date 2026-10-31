---
title: "Dual Nature: Quick Practice"
type: practice
chapter: c12.physics.dual-nature-of-radiation-and-matter
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. Unless a question gives other values, use $h = 6.63 \times 10^{-34}$ J s, $c = 3 \times 10^8$ m/s, $e = 1.6 \times 10^{-19}$ C and $hc = 1240$ eV nm.

## Photons

:::question{title="1. Energy of a photon" exam="NEET level"}
Find the energy of a photon of red light of wavelength 620 nm, in eV and in joules.

---

$E = \dfrac{hc}{\lambda} = \dfrac{1240}{620} =$ **2.0 eV**.

In joules: $2.0 \times 1.6 \times 10^{-19} =$ **3.2 × 10⁻¹⁹ J**.
:::

:::question{title="2. Photons from a laser" exam="NEET level"}
A laser gives out 3.3 mW of light of wavelength 600 nm. How many photons does it emit per second?

---

Energy of one photon:
$$\begin{aligned} E &= \frac{hc}{\lambda} \\ &= \frac{6.63 \times 10^{-34} \times 3 \times 10^8}{6 \times 10^{-7}} \end{aligned}$$
so $E \approx 3.3 \times 10^{-19}$ J.

$N = \dfrac{P}{E} = \dfrac{3.3 \times 10^{-3}}{3.3 \times 10^{-19}} \approx$ **1.0 × 10¹⁶ photons per second**.
:::

## Photoelectric effect

:::question{title="3. Stopping potential" exam="NEET level"}
Light of wavelength 310 nm falls on a metal of work function 2.3 eV. Find the maximum kinetic energy of the photoelectrons and the stopping potential.

---

Photon energy $= \dfrac{1240}{310} = 4.0$ eV.

$K_{max} = h\nu - \phi_0 = 4.0 - 2.3 =$ **1.7 eV**, so $V_0 =$ **1.7 V**.
:::

:::question{title="4. Threshold wavelength" exam="NEET level"}
A metal has a work function of 2.48 eV. Find its threshold wavelength. Will light of 400 nm eject electrons? Will light of 600 nm?

---

$\lambda_0 = \dfrac{hc}{\phi_0} = \dfrac{1240}{2.48} =$ **500 nm**.

Emission needs $\lambda \le \lambda_0$. So **400 nm ejects electrons**, and **600 nm does not**, however bright it is.
:::

:::question{title="5. Brighter light" exam="NEET level"}
Light above the threshold frequency falls on a metal. Its intensity is doubled, with the frequency unchanged. What happens to (a) the maximum kinetic energy of the photoelectrons, and (b) the saturation current?

---

(a) **No change.** $K_{max} = h\nu - \phi_0$ depends on the frequency, not the intensity.

(b) **It doubles.** Twice as many photons per second eject twice as many electrons per second.
:::

:::question{title="6. Planck's constant from a graph" exam="JEE Main level"}
In a photoelectric experiment, light of frequency $8.0 \times 10^{14}$ Hz gives a stopping potential of 1.30 V. Light of frequency $1.2 \times 10^{15}$ Hz gives 2.95 V. Find Planck's constant and the work function of the metal (in eV).

---

The $V_0$–$\nu$ line has slope $h/e$:
$$\frac{h}{e} = \frac{2.95 - 1.30}{(12 - 8) \times 10^{14}}$$
so $h/e = 4.125 \times 10^{-15}$ V s, and $h = 4.125 \times 10^{-15} \times 1.6 \times 10^{-19} =$ **6.6 × 10⁻³⁴ J s**.

Work function: $\phi_0/e = (h/e)\nu - V_0 = 4.125 \times 10^{-15} \times 8 \times 10^{14} - 1.30 = 3.30 - 1.30$, so $\phi_0 =$ **2.0 eV**. (The second point gives $4.95 - 2.95 = 2.0$ eV too.)
:::

:::question{title="7. Doubling the photon energy" exam="JEE Main level"}
Photons of energy 4 eV fall on a metal of work function 2 eV. If the photon energy is doubled, by what factor does the stopping potential change?

---

Before: $eV_0 = 4 - 2 = 2$ eV, so $V_0 = 2$ V.

After: $eV_0 = 8 - 2 = 6$ eV, so $V_0 = 6$ V.

The stopping potential becomes **3 times** larger, not 2 times, because the work function is subtracted.
:::

## Matter waves

:::question{title="8. Electron through 100 V" exam="NEET level"}
An electron starting from rest is accelerated through a potential difference of 100 V. Find its de Broglie wavelength.

---

$\lambda = \dfrac{h}{\sqrt{2meV}} = \dfrac{1.227}{\sqrt{V}}$ nm $= \dfrac{1.227}{\sqrt{100}}$ nm $\approx$ **0.123 nm**.
:::

:::question{title="9. Proton and alpha particle" exam="JEE Main level"}
A proton and an alpha particle, both starting from rest, are accelerated through the same potential difference. Find the ratio of their de Broglie wavelengths, $\lambda_p : \lambda_\alpha$. (Take $m_\alpha = 4m_p$ and $q_\alpha = 2e$.)

---

Kinetic energy gained $= qV$, so $p = \sqrt{2mqV}$ and $\lambda = \dfrac{h}{\sqrt{2mqV}}$.
With $h$ and $V$ the same, $\lambda \propto 1/\sqrt{mq}$, so $\lambda_p/\lambda_\alpha = \sqrt{(m_\alpha q_\alpha)/(m_p q_p)}$:
$$\frac{\lambda_p}{\lambda_\alpha} = \sqrt{4 \times 2} = 2\sqrt2$$
So $\lambda_p : \lambda_\alpha =$ **2√2 : 1** (about 2.83 : 1).
:::

:::question{title="10. Electron and proton, same energy" exam="NEET level"}
An electron and a proton have the same kinetic energy. Which has the longer de Broglie wavelength, and by roughly how many times? (Take $m_p = 1836\,m_e$.)

---

$\lambda = \dfrac{h}{\sqrt{2mK}}$, so for the same $K$, $\lambda \propto \dfrac{1}{\sqrt m}$.
$$\frac{\lambda_e}{\lambda_p} = \sqrt{\frac{m_p}{m_e}}$$
$$\frac{\lambda_e}{\lambda_p} = \sqrt{1836} \approx 43$$
The **electron** has the longer wavelength, about **43 times** that of the proton.
:::
