describe("Terms Lens demo", () => {
  it("shows an evidence-backed risk, then honestly rejects an unsupported quote", () => {
    cy.visit("/demo.html");
    cy.contains("Hukuki tavsiye değildir").should("be.visible");
    cy.get("[data-injection]").should("not.be.visible");
    cy.wait(3000);

    cy.get("[data-cy=happy]").click();
    cy.get("[data-cy=prompt-defense]").should("contain.text", "hidden instruction excluded");
    cy.get("[data-cy=score]").should("have.text", "Risk skoru: 22/100");
    cy.get("[data-cy=citation]").should(
      "contain.text",
      "Spotify reserves the right to change our Spotify Service offerings"
    );
    cy.contains("hizmetteki değişikliklere önceden bildirim olmadan").should("be.visible");
    cy.get("[data-cy=uncertainty]").should("contain.text", "tüm sözleşmeyi temsil etmez");
    cy.wait(4000);

    cy.get("[data-cy=uncertain]").click();
    cy.get("[data-cy=score]").should("have.text", "Risk skoru: 0/100");
    cy.get("[data-cy=citation]").should("not.exist");
    cy.get("[data-cy=uncertainty]").should("contain.text", "kaynak metinde birebir alıntıyla doğrulanmadığı");
    cy.contains("permanently retain all personal data").should("not.exist");
    cy.wait(3000);
  });
});
