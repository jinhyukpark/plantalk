package com.unb.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
class EmailServiceTest {

    @Test
    void sendsAccountRecoveryEmailThroughConfiguredSmtp() {
        CapturingMailSender sender = new CapturingMailSender();
        ObjectProvider<JavaMailSender> provider = providerWith(sender);
        EmailService service = new EmailService(
                provider, "smtp.example.com", "support@example.com", "mailer@example.com", true);

        service.sendEmail("member@example.com", "Reset code", "123456");

        assertEquals("member@example.com", sender.message.getTo()[0]);
        assertEquals("support@example.com", sender.message.getFrom());
        assertEquals("Reset code", sender.message.getSubject());
        assertEquals("123456", sender.message.getText());
    }

    @Test
    void rejectsAuthenticatedSmtpWithoutUsername() {
        ObjectProvider<JavaMailSender> provider = emptyProvider();
        EmailService service = new EmailService(
                provider, "smtp.example.com", "support@example.com", "", true);

        IllegalStateException error = assertThrows(
                IllegalStateException.class,
                () -> service.sendEmail("member@example.com", "Reset code", "123456"));

        assertEquals("SMTP 인증 계정이 설정되지 않았습니다", error.getMessage());
    }

    @Test
    void rejectsSmtpWithoutFromAddress() {
        ObjectProvider<JavaMailSender> provider = emptyProvider();
        EmailService service = new EmailService(
                provider, "smtp.example.com", "", "mailer@example.com", true);

        IllegalStateException error = assertThrows(
                IllegalStateException.class,
                () -> service.sendEmail("member@example.com", "Reset code", "123456"));

        assertEquals("발신 이메일 주소가 설정되지 않았습니다", error.getMessage());
    }

    private ObjectProvider<JavaMailSender> providerWith(JavaMailSender sender) {
        StaticListableBeanFactory factory = new StaticListableBeanFactory();
        factory.addBean("mailSender", sender);
        return factory.getBeanProvider(JavaMailSender.class);
    }

    private ObjectProvider<JavaMailSender> emptyProvider() {
        return new StaticListableBeanFactory().getBeanProvider(JavaMailSender.class);
    }

    private static class CapturingMailSender extends JavaMailSenderImpl {
        private SimpleMailMessage message;

        @Override
        public void send(SimpleMailMessage simpleMessage) {
            this.message = simpleMessage;
        }
    }
}
