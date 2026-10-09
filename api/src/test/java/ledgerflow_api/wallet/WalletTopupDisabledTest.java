package ledgerflow_api.wallet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import ledgerflow_api.TestcontainersConfiguration;
import ledgerflow_api.account.AccountRepository;
import ledgerflow_api.transfer.TransferRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = "ledgerflow.simulator.topups-enabled=false")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class WalletTopupDisabledTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired AccountRepository accounts;
    @Autowired TransferRepository transfers;

    @Test
    void disabledSimulatorTopupsDoNotPost() throws Exception {
        String email = "disabled-" + UUID.randomUUID() + "@example.test";
        MvcResult registration = mvc.perform(post("/api/wallet/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"Long-strong-password-123!\"}"))
                .andExpect(status().isCreated()).andReturn();
        String token = mapper.readTree(registration.getResponse().getContentAsString()).get("accessToken").asText();
        String auth = "Bearer " + token;
        UUID walletId = UUID.fromString(mapper.readTree(mvc.perform(get("/api/wallet/me").header("Authorization", auth))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asText());
        long countBefore = transfers.count();

        mvc.perform(post("/api/wallet/topups").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":10,\"idempotencyKey\":\"disabled-" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isForbidden());

        assertThat(transfers.count()).isEqualTo(countBefore);
        assertThat(accounts.findById(walletId).orElseThrow().getCurrentBalance()).isEqualByComparingTo("0.00");
    }
}
