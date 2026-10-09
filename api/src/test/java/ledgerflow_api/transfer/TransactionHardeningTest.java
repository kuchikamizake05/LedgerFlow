package ledgerflow_api.transfer;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import ledgerflow_api.TestcontainersConfiguration;
import ledgerflow_api.account.*;
import ledgerflow_api.auth.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import ledgerflow_api.transfer.CreateTransferRequest;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
@SpringBootTest @AutoConfigureMockMvc @Import(TestcontainersConfiguration.class)
class TransactionHardeningTest {
 @Autowired MockMvc mvc; @Autowired AccountRepository accounts;
 @Autowired TransferRepository transfers; @Autowired LedgerEntryRepository entries; @Autowired JwtService jwt; @Autowired TransferService transferService;
 int send(String path,String body,AppRole role) throws Exception {
  String token=jwt.issue(new AppUser(UUID.randomUUID()+"@test.local","unused",role)).value();
  return mvc.perform(post(path).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getStatus();
 }
 Account account(String amount) {return accounts.saveAndFlush(new Account("Hardening",AccountType.BANK,new BigDecimal(amount)));}
 String transfer(UUID source,UUID target,String amount,String key) {
  return "{\"sourceAccountId\":\""+source+"\",\"targetAccountId\":\""+target+"\",\"amount\":"+amount+",\"idempotencyKey\":\""+key+"\"}";
 }
 @Test void treasuryCannotBeSpentThroughOrdinaryTransfers() throws Exception {
  UUID target=account("0").getId();
  for(AppRole role:new AppRole[]{AppRole.OPERATOR,AppRole.TREASURY_ADMIN})
   assertThat(send("/api/transfers",transfer(TransferService.SYSTEM_TREASURY_ID,target,"1.00",UUID.randomUUID().toString()),role)).isEqualTo(403);
 }
 @Test void ordinaryTransferEndpointRequiresApproval() throws Exception {
  assertThat(send("/api/transfers",transfer(account("1").getId(),account("0").getId(),"1.00",UUID.randomUUID().toString()),AppRole.OPERATOR)).isEqualTo(409);
 }
 @Test void monetaryInputsRejectPrecisionAndOverflow() throws Exception {
  UUID source=account("100").getId(),target=account("0").getId();
  for(String amount:new String[]{"1.001","100000000000000000.00"}) {
   assertThat(send("/api/transfers",transfer(source,target,amount,UUID.randomUUID().toString()),AppRole.OPERATOR)).isEqualTo(400);
   assertThat(send("/api/accounts/"+target+"/deposits","{\"amount\":"+amount+",\"idempotencyKey\":\""+UUID.randomUUID()+"\"}",AppRole.TREASURY_ADMIN)).isEqualTo(400);
   assertThat(send("/api/accounts","{\"name\":\"precision\",\"type\":\"BANK\",\"openingBalance\":"+amount+"}",AppRole.TREASURY_ADMIN)).isEqualTo(400);
  }
 }
 @Test void depositReturnsReplayAndRejectsChangedPayload() throws Exception {
  UUID target=account("0").getId(); String key=UUID.randomUUID().toString(),path="/api/accounts/"+target+"/deposits";
  String body="{\"amount\":1.00,\"idempotencyKey\":\""+key+"\"}";
  assertThat(send(path,body,AppRole.TREASURY_ADMIN)).isEqualTo(201);
  assertThat(send(path,body,AppRole.TREASURY_ADMIN)).isEqualTo(200);
  assertThat(send(path,body.replace("1.00","2.00"),AppRole.TREASURY_ADMIN)).isEqualTo(409);
  assertThat(accounts.findById(target).orElseThrow().getCurrentBalance()).isEqualByComparingTo("1");
 }
 @Test void recipientBalanceOverflowRollsBackWithoutPostings() throws Exception {
  Account source=account("1.00"),target=account("99999999999999999.99");
  String key=UUID.randomUUID().toString();
  assertThatThrownBy(() -> transferService.executeTransfer(new CreateTransferRequest(
          source.getId(), target.getId(), new BigDecimal("0.01"), key, null)))
      .isInstanceOf(ResponseStatusException.class)
      .satisfies(exception -> assertThat(((ResponseStatusException) exception).getStatusCode().value()).isEqualTo(400));
  assertThat(accounts.findById(source.getId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("1.00");
  assertThat(accounts.findById(target.getId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("99999999999999999.99");
  assertThat(transfers.findByIdempotencyKey(key)).isEmpty();
  assertThat(entries.findAll().stream().filter(entry->entry.getAccountId().equals(target.getId())).toList()).isEmpty();
 }
 @Test void concurrentFullBalanceTransferReplays() throws Exception {
  Account source=account("1"),target=account("0"); String key=UUID.randomUUID().toString();
  concurrentTransfer(source,target,key);
  assertThat(accounts.findById(source.getId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("0");
  assertThat(accounts.findById(target.getId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("1");
 }
 @Test void concurrentDepositsReplay() throws Exception {
  Account target=account("0"); String key=UUID.randomUUID().toString();
  concurrent("/api/accounts/"+target.getId()+"/deposits","{\"amount\":1.00,\"idempotencyKey\":\""+key+"\"}",AppRole.TREASURY_ADMIN,key);
  assertThat(accounts.findById(target.getId()).orElseThrow().getCurrentBalance()).isEqualByComparingTo("1");
 }
 void concurrent(String path,String body,AppRole role,String key) throws Exception {
  CountDownLatch start=new CountDownLatch(1);
  try(ExecutorService pool=Executors.newFixedThreadPool(2)) {
   Callable<Integer> request=()->{start.await();return send(path,body,role);};
   Future<Integer> a=pool.submit(request),b=pool.submit(request); start.countDown();
   assertThat(java.util.List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,200);
  }
  assertThat(entries.findByTransferIdOrderByCreatedAtAsc(transfers.findByIdempotencyKey(key).orElseThrow().getId())).hasSize(2);
 }
 void concurrentTransfer(Account source,Account target,String key) throws Exception {
  CountDownLatch start=new CountDownLatch(1);
  try(ExecutorService pool=Executors.newFixedThreadPool(2)) {
   Callable<Boolean> request=()->{start.await();return transferService.executeTransfer(new CreateTransferRequest(
           source.getId(),target.getId(),new BigDecimal("1.00"),key,"Concurrent retry")).replayed();};
   Future<Boolean> a=pool.submit(request),b=pool.submit(request); start.countDown();
   assertThat(java.util.List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(false,true);
  }
  assertThat(entries.findByTransferIdOrderByCreatedAtAsc(transfers.findByIdempotencyKey(key).orElseThrow().getId())).hasSize(2);
 }
}


