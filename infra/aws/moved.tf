moved {
  from = aws_vpc.main
  to   = module.network.aws_vpc.main
}

moved {
  from = aws_subnet.public
  to   = module.network.aws_subnet.public
}

moved {
  from = aws_internet_gateway.main
  to   = module.network.aws_internet_gateway.main
}

moved {
  from = aws_route_table.public
  to   = module.network.aws_route_table.public
}

moved {
  from = aws_route_table_association.public
  to   = module.network.aws_route_table_association.public
}

moved {
  from = aws_security_group.node
  to   = module.network.aws_security_group.node
}

moved {
  from = aws_key_pair.admin
  to   = module.compute.aws_key_pair.admin
}

moved {
  from = aws_instance.node
  to   = module.compute.aws_instance.node
}