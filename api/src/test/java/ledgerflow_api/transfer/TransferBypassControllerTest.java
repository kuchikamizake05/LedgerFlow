package ledgerflow_api.transfer;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class TransferBypassControllerTest {
    @Test
    void directTransferEndpointRejectsExecutionWithoutCallingMovementService() throws Exception {
        TransferService transferService = mock(TransferService.class);
        TransferResponse completedTransfer = new TransferResponse(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), new BigDecimal("1.00"),
                TransferStatus.COMPLETED, "bypass-test", "Direct payment", Instant.now(), null);
        when(transferService.executeTransfer(org.mockito.ArgumentMatchers.any(CreateTransferRequest.class)))
                .thenReturn(new TransferExecutionResult(completedTransfer, false));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new TransferController(transferService)).build();

        mvc.perform(post("/api/transfers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sourceAccountId":"%s","targetAccountId":"%s","amount":1.00,"idempotencyKey":"bypass-test","description":"Direct payment"}
                                """.formatted(UUID.randomUUID(), UUID.randomUUID())))
                .andExpect(status().isConflict());

        verifyNoInteractions(transferService);
    }
}
