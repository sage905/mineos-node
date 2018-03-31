FROM registry.access.redhat.com/rhscl/nodejs-4-rhel7
MAINTAINER Sage905 <sage905@takeflight.ca>
USER root

#update and accept all prompts
# Update image
RUN yum repolist --disablerepo=* && \
    yum-config-manager --disable \* > /dev/null && \
    yum-config-manager --enable rhel-7-server-rpms > /dev/null
RUN yum update -y \
RUN yum install\
  supervisor \
  rdiff-backup \
  screen \
  rsync \
  git \
  curl \
  rlwrap

#install node from nodesource
#RUN curl --silent --location https://rpm.nodesource.com/setup_4.x | bash -
#RUN yum -y install nodejs

#download mineos from github
RUN mkdir /usr/games/minecraft \
  && cd /usr/games/minecraft \
  && git clone --depth=1 https://github.com/hexparrot/mineos-node.git . \
  && cp mineos.conf /etc/mineos.conf \
  && chmod +x webui.js mineos_console.js service.js

#build npm deps and clean up apt for image minimalization
RUN cd /usr/games/minecraft \
  && yum groupinstall 'Development Tools'\
  && npm install \
  && yum groupremove 'Development Tools' \
  && yum clean all\

#configure and run supervisor
RUN cp /usr/games/minecraft/init/supervisor_conf /etc/supervisor/conf.d/mineos.conf
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]

#entrypoint allowing for setting of mc password
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

EXPOSE 8443 25565-25570
VOLUME /var/games/minecraft
